import * as process from 'node:process';
import { makeNewMigration } from '@utils/makeNewMigration';
import { makeNewModule } from '@utils/makeNewModule';
import { refreshSlashCommands } from '@utils/refreshSlashCommands';

const [,, command, name] = process.argv;

if (!command) notifyAndExit('Hey Weirdo, usage: bun blip <command> <name>');

async function main() {
  switch (command) {
    case 'help':
      console.log("Nah, i'm good you weirdo...");
      break;

    case 'refresh:slash':
      await refreshSlashCommands(true);
      break;

    case 'new:module':
      if (!name) notifyAndExit('Hey weirdo, usage: bun blip new:module <name>');
      await makeNewModule(name);
      break;

    case 'new:migration':
      if (!name) notifyAndExit('Hey weirdo, usage: bun blip new:migration <name>');
      await makeNewMigration(name);
      break;

    default:
      notifyAndExit(`Weirdo, ${command} not known!`);
  }
}

main().catch(err => {
  notifyAndExit(`Oops: ${err.message}`);
});

function notifyAndExit(message: any) {
  console.error(message);
  process.exit(1);
}