import fs from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
import { Logging } from "@utils/logging";
import { getEnv } from "@utils/env";

async function loadModules(client: any) {
	let modulesPath: string;
	let moduleFolders: string[] = [];
	const apiModules: ((app: any, client: any) => void)[] = [];

	try {
		modulesPath = path.join(<string>getEnv("MODULES_BASE_PATH"), "modules");
		moduleFolders = await fs.readdir(modulesPath);
	} catch (error) {
		Logging.error(`Error loading modules in moduleLoader: ${error}`);
		return;
	}

	for (const moduleFolder of moduleFolders) {
		let moduleLoaded = false;
		Logging.info("Loading module: " + moduleFolder);
		const modulePath = path.join(modulesPath, moduleFolder);

		const initialized = {
			commandsListener: false,
			events: false,
			tasks: false,
			api: false
		};

		const commandsFile = path.join(modulePath, "commands.ts");
		try {
			await fs.access(commandsFile);
			const commandsURL = pathToFileURL(commandsFile).href;
			const commandsModule = await import(commandsURL);

			if (!commandsModule.commands) {
				Logging.warn(`Module ${moduleFolder} commands.ts does not have "commands" export`);
			} else {
				Logging.debug(`Loaded commands for module: ${moduleFolder}`);
				moduleLoaded = true;
			}
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
				Logging.error(`Error loading commands for module "${moduleFolder}": ${error}`);
			}
		}

		if (!initialized.commandsListener) {
			const commandsListenerFile = path.join(modulePath, "commandsListener.ts");
			try {
				await fs.access(commandsListenerFile);
				const commandsListenerURL = pathToFileURL(commandsListenerFile).href;
				const commandsListeners = await import(commandsListenerURL);

				if (!commandsListeners.default) {
					Logging.error(`Module ${moduleFolder} commandsListener.ts does not have a default export`);
				} else {
					new commandsListeners.default(client);
					Logging.debug(`Loaded commandsListener for module: ${moduleFolder}`);
					moduleLoaded = true;
					initialized.commandsListener = true;
				}
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
					Logging.error(`Error loading commandsListener for module "${moduleFolder}": ${error}`);
				}
			}
		}

		if (!initialized.events) {
			const eventsFile = path.join(modulePath, "events.ts");
			try {
				await fs.access(eventsFile);
				const eventsURL = pathToFileURL(eventsFile).href;
				const events = await import(eventsURL);

				if (!events.default) {
					Logging.error(`Module ${moduleFolder} events.ts does not have a default export`);
				} else {
					new events.default(client);
					Logging.debug(`Loaded events for module: ${moduleFolder}`);
					moduleLoaded = true;
					initialized.events = true;
				}
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
					Logging.error(`Error loading events for module "${moduleFolder}": ${error}`);
				}
			}
		}

		if (!initialized.tasks) {
			const tasksFile = path.join(modulePath, "tasks.ts");
			try {
				await fs.access(tasksFile);
				const tasksURL = pathToFileURL(tasksFile).href;
				const tasks = await import(tasksURL);

				if (!tasks.default) {
					Logging.error(`Module ${moduleFolder} tasks.ts does not have a default export`);
				} else {
					new tasks.default(client);
					Logging.debug(`Loaded tasks for module: ${moduleFolder}`);
					moduleLoaded = true;
					initialized.tasks = true;
				}
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
					Logging.error(`Error loading tasks for module "${moduleFolder}": ${error}`);
				}
			}
		}

		if (!initialized.api) {
			const apiFile = path.join(modulePath, "api.ts");
			try {
				await fs.access(apiFile);
				const apiURL = pathToFileURL(apiFile).href;
				const apiModule = await import(apiURL);

				if (!apiModule.default) {
					Logging.error(`Module ${moduleFolder} api.ts does not have a default export`);
				} else {
					apiModules.push(apiModule.default);
					Logging.debug(`Loaded API for module: ${moduleFolder}`);
					moduleLoaded = true;
					initialized.api = true;
				}
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
					Logging.error(`Error loading api for module "${moduleFolder}": ${error}`);
				}
			}
		}

		if (moduleLoaded) {
			Logging.info(`Loaded module "${moduleFolder}": ${modulePath}`);
		} else {
			Logging.warn(`Module "${moduleFolder}" did not load any components`);
		}
	}

	return apiModules;
}

export default loadModules;
