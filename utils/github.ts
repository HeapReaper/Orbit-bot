import { getEnv } from "@utils/env";
import { Logging } from "@utils/logging.ts";

export class Github {
    private owner: string;
    private repo: string;

    constructor(owner: string, repo: string) {
        this.owner = owner;
        this.repo = repo;
    }

    static async getCurrentRelease(): Promise<string | null> {
        const response: Response = await fetch(
            `https://api.github.com/repos/${<string>getEnv("REPO_OWNER")}/${<string>getEnv("REPO_NAME")}/releases/latest`
        );

        if (!response.ok) {
            Logging.warn(`Error fetching repo in bootEvent: ${response.status}`)
            return null;
        }

        const repoData = await response.json();

        return repoData.tag_name;
    }

    static async getLatestCommit(): Promise<{ sha: string; url: string } | null> {
        const owner = <string>getEnv("REPO_OWNER");
        const repo = <string>getEnv("REPO_NAME");

        const response: Response = await fetch(
          `https://api.github.com/repos/${<string>getEnv("REPO_OWNER")}/${<string>getEnv("REPO_NAME")}/commits`
        );

        if (!response.ok) {
            Logging.warn(`Error fetching latest commit: ${response.status}`);
            return null;
        }

        const commitData = await response.json();
        if (!commitData || !Array.isArray(commitData) || commitData.length === 0) {
            Logging.error("No commits found");
            return null;
        }

        const latestCommit = commitData[0];

        return {
            sha: latestCommit.sha,
            url: latestCommit.html_url,
        };
    }
}