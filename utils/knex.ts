import knex, { Knex as KnexType } from "knex";
import { getEnv } from "@utils/env";

class Database {
    private db: KnexType;

    constructor() {
        this.db = knex({
            client: "mysql2",
            connection: {
                host: <string>getEnv("DATABASE_HOST"),
                port: 3306,
                user: <string>getEnv("DATABASE_USER"),
                password: <string>getEnv("DATABASE_PASSWORD"),
                database: <string>getEnv("DATABASE_NAME"),
            },
        });
    }

    public getConnection(): KnexType {
        return this.db;
    }
}

export default new Database().getConnection();
