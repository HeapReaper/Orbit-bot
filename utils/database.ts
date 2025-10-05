import { getEnv } from "@utils/env";
import mysql, {QueryResult} from "mysql2";
import { Connection } from "mysql2/typings/mysql/lib/Connection";
import {Logging} from "@utils/logging";

class QueryBuilder {
    static connection: Connection;
    private _tableName: string | undefined;
    private _columnsArray: string[] = ["*"];
    private _whereClause: {} = {};
    private _orderByColumnName: string | null = null;
    private _orderByDirection: "ASC" | "DESC" = "DESC";
    private _limitNumber: number | null = null;
    private _currentMode: string = "";
    private _firstMode: Boolean = false;
    private _updateValues: Record<string, any> = {};
    private _insertValues: Record<string, any> = {};
    private _countBoolean: Boolean = false;
    private _loggingEnabled: boolean = false;
    private _rawQuery: string = "";
    private _offset!: number ;

    static init() {
        QueryBuilder.connection = mysql.createConnection({
            host: <string>getEnv("DATABASE_HOST"),
            user: <string>getEnv("DATABASE_USER"),
            password: <string>getEnv("DATABASE_PASSWORD"),
            database: <string>getEnv("DATABASE_NAME"),
        });
    }

    static connect(): void {
        if (QueryBuilder.connection) return;
        QueryBuilder.init();
    }

    static close(): void {
        if (!QueryBuilder.connection) return;
        QueryBuilder.connection.end();
    }

    static select(tableName: string): QueryBuilder {
        const builder = new QueryBuilder();
        builder._tableName = tableName;
        builder._currentMode = "select";
        return builder;
    }

    static update(tableName: string) {
        const builder = new QueryBuilder();
        builder._tableName = tableName;
        builder._currentMode = "update";
        return builder;
    }

    static delete(tableName: string) {
        const builder = new QueryBuilder();
        builder._tableName = tableName;
        builder._currentMode = "delete";
        return builder;
    }

    static insert(tableName: string) {
        const builder = new QueryBuilder();
        builder._tableName = tableName;
        builder._currentMode = "insert";
        return builder;
    }

    static raw(query: string): QueryBuilder {
        const builder = new QueryBuilder();
        builder._tableName = "raw";
        builder._rawQuery = query;
        return builder;
    }

    logging(enabled: boolean): QueryBuilder {
        this._loggingEnabled = enabled;
        return this;
    }

    columns(columns: string[]): QueryBuilder {
        this._columnsArray = columns;
        return this;
    }

    where(conditions: Record<string, any>): QueryBuilder {
        this._whereClause = conditions;
        return this;
    }

    limit(limit: number): QueryBuilder {
        this._limitNumber = limit;
        return this;
    }

    orderBy(column: string, direction: "ASC" | "DESC" = "DESC"): QueryBuilder {
        this._orderByColumnName = column;
        this._orderByDirection = direction;
        return this;
    }

    set(values: Record<string, any>): QueryBuilder {
        this._updateValues = values;
        return this;
    }

    values(values: Record<string, any>): QueryBuilder {
        this._insertValues = values;
        return this;
    }

    count(): QueryBuilder {
        this._countBoolean = true;
        return this;
    }

    offset(n: number): QueryBuilder {
        this._offset = n
        return this;
    }

    private async executeSelect(): Promise<any> {
        if (!QueryBuilder.connection) QueryBuilder.connect();

        let countString: string = "";
        this._countBoolean ? countString = "COUNT(*) " : countString = "";

        let columnClause = this._columnsArray.join(", ");

        if (countString && columnClause[0] === "*") {
            columnClause = "";
        }

        let whereString: string = "";
        const whereValues: any[] = []
        if (Object.keys(this._whereClause).length > 0) {
            whereString = " WHERE " + Object.entries(this._whereClause)
              .map(([key, value]) => {
                  whereValues.push(value);
                  return `${key} = ?`;
              })
              .join(" AND ");
        }

        let orderByString: string = "";
        if (this._orderByColumnName !== null) orderByString = ` ORDER BY ${this._orderByColumnName} ${this._orderByDirection}`;

        let limitString: string = "";
        this._limitNumber !== null ? limitString = ` LIMIT ${this._limitNumber}` : limitString = "";

        let offsetString: string = "";
        if (this._offset !== undefined) offsetString = ` OFFSET ${this._offset}`;

        const sql = `SELECT ${countString}${columnClause} FROM ${this._tableName}${whereString}${orderByString}${limitString}${offsetString}`;

        Logging.trace(`Running select query: ${sql}`);

        const startTime: number = Date.now();

        return new Promise((resolve, reject) => {
            QueryBuilder.connection.query(sql, whereValues, (err, res: any) => {
                if (this._loggingEnabled) Logging.info(`Select query duration: ${Date.now() - startTime}ms`);

                if (err) return reject(err);

                if (this._firstMode) return resolve(res[0]);

                if (this._countBoolean) return resolve(res[0]["COUNT(*)"]);

                return resolve(res);
            })
        })
    }

    private async executeUpdate(): Promise<any> {
        if (!QueryBuilder.connection) QueryBuilder.connect();

        let updateString = " SET " + Object.entries(this._updateValues)
          .map(([key, value]) => `${key} = ?`)
          .join(", ");

        let whereString = "";
        const whereValues: any[] = Object.values(this._updateValues);

        if (Object.keys(this._whereClause).length > 0) {
            whereString = " WHERE " + Object.entries(this._whereClause)
              .map(([key, value]) => {
                  whereValues.push(value);
                  return `${key} = ?`;
              })
              .join(" AND ");
        }


        const sql = `UPDATE ${this._tableName}${updateString}${whereString}`;

        Logging.trace(`Running update query: ${sql}`);

        const startTime: number = Date.now();

        return new Promise((resolve, reject) => {
            QueryBuilder.connection.query(sql, whereValues, (err, res) => {
                if (this._loggingEnabled) Logging.info(`Update query duration: ${Date.now() - startTime}ms`);

                if (err) return reject(err);

                resolve(res);
            })
        })
    }

    private async executeDelete(): Promise<any> {
        if (!QueryBuilder.connection) QueryBuilder.connect();

        let whereString: string = "";
        const whereValues: any[] = []
        if (Object.keys(this._whereClause).length > 0) {
            whereString = " WHERE " + Object.entries(this._whereClause)
              .map(([key, value]) => {
                  whereValues.push(value);
                  return `${key} = ?`;
              })
              .join(" AND ");
        }

        const sql = `DELETE FROM ${this._tableName}${whereString}`;

        Logging.trace(`Running delete query: ${sql}`);

        const startTime: number = Date.now();

        return new Promise((resolve, reject) => {
            QueryBuilder.connection.query(sql, whereValues, (err, res) => {
                if (this._loggingEnabled) Logging.info(`Delete query duration: ${Date.now() - startTime}ms`);

                if (err) return reject(err);

                resolve(res);
            })
        })
    }

    private async executeInsert(): Promise<any> {
        if (!QueryBuilder.connection) QueryBuilder.connect();

        const columns = Object.keys(this._insertValues).join(", ");
        const placeholders = Object.values(this._insertValues).map(() => "?").join(", ");
        const values = Object.values(this._insertValues);

        const sql = `INSERT INTO ${this._tableName} (${columns}) VALUES (${placeholders})`;

        Logging.trace(`Running insert query: ${sql}`);

        const startTime: number = Date.now();

        return new Promise((resolve, reject) => {
            QueryBuilder.connection.query(sql, values, (err, res) => {
                if (this._loggingEnabled) Logging.info(`Insert query duration: ${Date.now() - startTime}ms`);

                if (err) return reject(err);

                resolve(res);
            })
        })
    }

    private async executeRaw(): Promise<any> {
        if (!QueryBuilder.connection) QueryBuilder.connect();
        const startTime: number = Date.now();

        Logging.trace(`Running raw query: ${this._rawQuery}`);

        return new Promise<any>((resolve, reject) => {
            QueryBuilder.connection.query(this._rawQuery, (err, res) => {
                if (this._loggingEnabled) Logging.info(`Raw query duration: ${Date.now() - startTime}ms`);

                if (err) return reject(err);

                resolve(res);
            })
        })
    }

    static async isOnline(): Promise<boolean> {
        try {
            const status = await QueryBuilder.status();
            return status.up;
        } catch {
            return false;
        }
    }

    static async status(): Promise<{ up: boolean; latency: number | null; error?: any }> {
        try {
            if (!QueryBuilder.connection) QueryBuilder.connect();

            Logging.trace(`Running status query`);

            const start = Date.now();

            const result = await new Promise((resolve, reject) => {
                QueryBuilder.connection.query("SELECT 1", (err, res) => {
                    if (err) return reject(err);
                    resolve(res);
                });
            });

            const latency = Date.now() - start;
            return { up: true, latency };
        } catch (error) {
            Logging.error(`Database status check failed: ${error}`);
            return { up: false, latency: null, error };
        }
    }

    async first(): Promise<any> {
        this._firstMode = true;
        return await this.executeSelect();
    }

    async get(): Promise<any> {
        return await this.executeSelect();
    }

    // @ts-ignore
    async execute(): Promise<any[]> {
        switch (this._currentMode) {
            case "select":
                return await this.executeSelect();
            case "update":
                return await this.executeUpdate();
            case "delete":
                return await this.executeDelete();
            case "insert":
                return await this.executeInsert();
            default:
                return await this.executeRaw();
        }
    }
}

// await QueryBuilder.insert("leveling").values({ user_id: "12345", xp: 0, level: 1 }).execute();
// await QueryBuilder.update("leveling").set({ xp: 100 }).where({ id: 1 }).execute();
// await QueryBuilder.delete("leveling").where({ id: 1 }).execute();

export default QueryBuilder;