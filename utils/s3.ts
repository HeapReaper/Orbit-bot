import * as Minio from "minio";
import { getEnv } from "@utils/env";
import { Logging } from "@utils/logging";

export default class S3OperationBuilder {
    private static minioClient: any;
    private bucketName: string | undefined;

    static init(): void {
        if (S3OperationBuilder.minioClient) return;

        try {
            const endpoint: string = (getEnv("S3_ENDPOINT") as string)?.replace(/^https?:\/\//, "");
            const port: number = getEnv("S3_PORT") as unknown as number || 443;
            const accessKey: string = getEnv("S3_ACCESS_KEY") as string;
            const secretKey: string = getEnv("S3_SECRET_KEY") as string;

            S3OperationBuilder.minioClient = new Minio.Client({
                endPoint: endpoint,
                port: 443,
                useSSL: true,
                accessKey,
                secretKey,
            });

            Logging.debug("MinIO client initialized successfully");
        } catch (error) {
            Logging.warn(`Failed to initialize MinIO client: ${error}`);
            S3OperationBuilder.minioClient = null;
        }
    }

    static setBucket(bucketName: string): S3OperationBuilder {
        S3OperationBuilder.init();

        const builder = new S3OperationBuilder();
        builder.bucketName = bucketName;

        return builder;
    }

    async uploadFileFromPath(objectName: string, filePath: string): Promise<any> {
        try {
            await S3OperationBuilder.minioClient.fPutObject(this.bucketName, objectName, filePath);

            Logging.debug("S3 upload successful!");
            return {success: true};
        } catch (error) {
            Logging.warn(`S3 upload failed: ${error}`);
            return {success: false, error: error};
        }
    }

    async uploadFileFromBuffer(objectName: string, buffer: Buffer, metaData?: Minio.ItemBucketMetadata): Promise<any> {
        try {
            await S3OperationBuilder.minioClient.putObject(this.bucketName, objectName, buffer, buffer.length, metaData);
            Logging.debug("S3 upload (buffer) successful!");
            return {success: true};
        } catch (error) {
            Logging.warn(`S3 upload (buffer) failed: ${error}`);
            return {success: false, error: error};
        }
    }

    async getObjectUrl(objectName: string): Promise<any> {
        try {
            const object = await S3OperationBuilder.minioClient.presignedGetObject(this.bucketName, objectName);

            Logging.debug("S3 getObject successful!");
            return {success: object};
        } catch (error) {
            Logging.warn(`S3 getObject failed: ${error}`);
            return {success: false, error: error};
        }
    }

    async deleteObject(objectName: string): Promise<any> {
        try {
            const object = await S3OperationBuilder.minioClient.removeObject(this.bucketName, objectName);

            Logging.debug("S3 delete successful!");
            return {success: object};
        } catch (error) {
            Logging.warn(`S3 delete failed: ${error}`);
            return {success: false, error: error};
        }
    }

    async listObjects(): Promise<any> {
        try {
            const data: any[] = [];
            const stream = await S3OperationBuilder.minioClient.listObjects(this.bucketName);


            return new Promise((resolve, reject) => {
                stream.on("data", (obj: Minio.BucketItem) => {
                    data.push(obj);
                });
                stream.on("end", () => {
                    Logging.debug(`S3 lists successful! Found ${data.length} objects.`);
                    resolve({success: true, data});
                });
                stream.on("error", (error: any) => {
                    Logging.warn(`S3 lists failed: ${error}`);
                    reject({success: false, error});
                });
            });
        } catch (error) {
            Logging.debug(`S3 lists failed: ${error}`);
            return {success: false, error: error};
        }
    }

    async status(): Promise<{ up: boolean; latency: number | null; error?: any }> {
        const start = Date.now();

        try {
            await S3OperationBuilder.minioClient.bucketExists(this.bucketName);

            const end = Date.now();
            return {
                up: true,
                latency: end - start,
            };
        } catch (error) {
            Logging.warn(`S3 status check failed: ${error}`);
            return {
                up: false,
                latency: null,
                error,
            };
        }
    }

}
