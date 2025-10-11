import {PrismaClient} from "@prisma/client";

const prisma = new PrismaClient();

export async function getBotSettings(guildId: string) {
  const data = await prisma.bot_settings.findFirst({
    where: {guild_id: guildId},
  });


}