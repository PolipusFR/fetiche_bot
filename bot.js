const { Client, GatewayIntentBits, EmbedBuilder, Partials } = require('discord.js');

// Config
const config = {
  token: 'NjgyOTc1NDc1OTUzMzAzNjgx.GN-S8b.Gr6imnlhShKkiMP2BIp0rDUSs2UbWtE-HDA6pM', // Token d'ID du bot
  channelIdToWatch: '1412897322211344434', // Channel #annonce lg
  logChannelId: '1439056100920918177', // Channel #detecteur a putes
};

// Créer le client Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Événement : Bot prêt
client.once('ready', () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
  console.log(`📡 Surveillance du channel: ${config.channelIdToWatch}`);
  console.log(`📝 Logs envoyés dans: ${config.logChannelId}`);
});

// Événement : Réaction ajoutée
client.on('messageReactionAdd', async (reaction, user) => {
  try {
    // Si la réaction est partielle, la récupérer complètement
    if (reaction.partial) {
      await reaction.fetch();
    }

    // Ignorer les réactions du bot lui-même
    if (user.bot) return;
    // Ignorer si c'est pas l'emoji participation
    if (reaction.emoji.toString() !== '✅') return;
    // Monitorer seulement les messages mentionnant le bot
    if (!reaction.message.mentions.has(client.user.id)) return;

    // Vérifier si c'est le bon channel
    if (reaction.message.channel.id !== config.channelIdToWatch) return;

    // Récupérer le channel de log
    const logChannel = await client.channels.fetch(config.logChannelId);
    if (!logChannel) return;

    // Créer un embed pour la notification
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Réaction Ajoutée')
      .setDescription(`**${user.tag}** a ajouté une réaction`)
      .addFields(
        { name: '👤 Utilisateur', value: `<@${user.id}>`, inline: true },
        { name: '📊 Total', value: `${reaction.count}`, inline: true },
      )
      .setTimestamp()

    await logChannel.send({ embeds: [embed] });

  } catch (error) {
    console.error('Erreur lors du traitement de la réaction ajoutée:', error);
  }
});

// Événement : Réaction retirée
client.on('messageReactionRemove', async (reaction, user) => {
  try {
    // Si la réaction est partielle, la récupérer complètement
    if (reaction.partial) {
      await reaction.fetch();
    }

    // Ignorer les réactions du bot lui-même
    if (user.bot) return;
    // Ignorer si c'est pas l'emoji participation
    if (reaction.emoji.toString() !== '✅') return;
    // Monitorer seulement les messages mentionnant le bot
    if (!reaction.message.mentions.has(client.user.id)) return;

    // Vérifier si c'est le bon channel
    if (reaction.message.channel.id !== config.channelIdToWatch) return;

    // Récupérer le channel de log
    const logChannel = await client.channels.fetch(config.logChannelId);
    if (!logChannel) return;

    // Créer un embed pour la notification
    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('❌ Réaction Retirée')
      .setDescription(`**${user.tag}** a retiré une réaction`)
      .addFields(
        { name: '👤 Utilisateur', value: `<@${user.id}>`, inline: true },
        { name: '📊 Total', value: `${reaction.count}`, inline: true }
      )
      .setTimestamp()

    await logChannel.send({ embeds: [embed] });

  } catch (error) {
    console.error('Erreur lors du traitement de la réaction retirée:', error);
  }
});

client.on('error', error => {
  console.error('Erreur du client Discord:', error);
});

process.on('unhandledRejection', error => {
  console.error('Erreur non gérée:', error);
});

client.login(config.token);