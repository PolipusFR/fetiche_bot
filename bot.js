const { Client, GatewayIntentBits, EmbedBuilder, Partials, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  token: process.env.TOKEN || 'VOTRE_TOKEN_BOT',
  channelIdToWatch: process.env.CHANNEL_ID_TO_WATCH || 'ID_DU_CHANNEL_A_SURVEILLER',
  logChannelId: process.env.LOG_CHANNEL_ID || 'ID_DU_CHANNEL_DE_LOG',
  clientId: process.env.CLIENT_ID || 'VOTRE_CLIENT_ID', // ID de l'application
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

// Variable pour stocker l'ID du dernier message mentionnant le bot
let lastBotMentionMessageId = null;

// Fichier de stockage des stats
const STATS_FILE = path.join(__dirname, 'uhc_stats.json');

// Charger les stats depuis le fichier
function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const data = fs.readFileSync(STATS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Erreur lors du chargement des stats:', error);
  }
  return { players: {}, games: [] };
}

// Sauvegarder les stats dans le fichier
function saveStats(stats) {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des stats:', error);
  }
}

// Initialiser les stats
let statsData = loadStats();

// Définir les commandes slash
const commands = [
  new SlashCommandBuilder()
    .setName('liste')
    .setDescription('Affiche la liste des utilisateurs ayant réagi au message surveillé'),
  
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Affiche les statistiques d\'un joueur')
    .addStringOption(option =>
      option.setName('joueur')
        .setDescription('Nom du joueur (optionnel, vous par défaut)')
        .setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('classement')
    .setDescription('Affiche le classement des meilleurs joueurs')
    .addStringOption(option =>
      option.setName('tri')
        .setDescription('Trier par')
        .setRequired(false)
        .addChoices(
          { name: 'Victoires', value: 'wins' },
          { name: 'Kills', value: 'kills' },
          { name: 'Winrate', value: 'winrate' }
        )),
  
  new SlashCommandBuilder()
    .setName('ajout_partie')
    .setDescription('Ajouter une partie de Loup-Garou')
    .addStringOption(option =>
      option.setName('gagnant')
        .setDescription('Nom du gagnant')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('joueurs')
        .setDescription('Liste des joueurs et leurs kills (ex: Joueur1:3,Joueur2:2,Joueur3:0)')
        .setRequired(true))
].map(command => command.toJSON());

// Enregistrer les commandes slash
const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
  try {
    console.log('🔄 Enregistrement des commandes slash...');
    await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commands },
    );
    console.log('✅ Commandes slash enregistrées avec succès!');
  } catch (error) {
    console.error('❌ Erreur lors de l\'enregistrement des commandes:', error);
  }
})();

// Événement : Bot prêt
client.once('ready', async () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
  console.log(`📡 Surveillance du channel: ${config.channelIdToWatch}`);
  console.log(`📝 Logs envoyés dans: ${config.logChannelId}`);
  
  // Rechercher le dernier message mentionnant le bot au démarrage
  try {
    const channel = await client.channels.fetch(config.channelIdToWatch);
    const messages = await channel.messages.fetch({ limit: 100 });
    
    const lastMention = messages.find(msg => msg.mentions.has(client.user.id));
    if (lastMention) {
      lastBotMentionMessageId = lastMention.id;
      console.log(`🎯 Dernier message avec mention trouvé: ${lastMention.id}`);
    } else {
      console.log(`⚠️ Aucun message mentionnant le bot trouvé dans les 100 derniers messages`);
    }
  } catch (error) {
    console.error('Erreur lors de la recherche du dernier message:', error);
  }
});

// Événement : Nouveau message (pour mettre à jour le dernier message mentionnant le bot)
client.on('messageCreate', async (message) => {
  // Ignorer les messages du bot
  if (message.author.bot) return;

  // Si c'est dans le bon channel et mentionne le bot
  if (message.channel.id === config.channelIdToWatch && message.mentions.has(client.user.id)) {
    lastBotMentionMessageId = message.id;
    console.log(`🎯 Nouveau message avec mention du bot: ${message.id}`);
  }

  // Commande: !reactions <messageId>
  if (message.content.startsWith('!reactions')) {
    const args = message.content.split(' ');
    if (args.length < 2) {
      return message.reply('Usage: `!reactions <messageId>`');
    }

    const messageId = args[1];

    try {
      // Récupérer le message
      const targetMessage = await message.channel.messages.fetch(messageId);
      
      if (!targetMessage.reactions.cache.size) {
        return message.reply('Ce message n\'a aucune réaction.');
      }

      // Créer un embed avec toutes les réactions
      const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📊 Réactions du Message')
        .setDescription(`[Lien vers le message](${targetMessage.url})`)
        .setTimestamp();

      // Parcourir toutes les réactions
      for (const [emoji, reaction] of targetMessage.reactions.cache) {
        const users = await reaction.users.fetch();
        const userList = users
          .filter(u => !u.bot)
          .map(u => `<@${u.id}>`)
          .join(', ') || '*Aucun utilisateur*';
        
        embed.addFields({
          name: `${emoji} (${reaction.count})`,
          value: userList,
          inline: false
        });
      }

      await message.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Erreur lors de la récupération des réactions:', error);
      message.reply('Impossible de trouver ce message ou de récupérer ses réactions.');
    }
  }
});
client.on('messageReactionAdd', async (reaction, user) => {
  try {
    // Si la réaction est partielle, la récupérer complètement
    if (reaction.partial) {
      await reaction.fetch();
    }

    // Ignorer les réactions du bot lui-même
    if (user.bot) return;

    // Vérifier si c'est le bon channel
    if (reaction.message.channel.id !== config.channelIdToWatch) return;

    // Vérifier si le message mentionne le bot
    if (!reaction.message.mentions.has(client.user.id)) return;

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
        { name: '😀 Réaction', value: reaction.emoji.toString(), inline: true },
        { name: '📊 Total', value: `${reaction.count}`, inline: true },
        { name: '💬 Message', value: reaction.message.content || '*[Message sans texte ou embed]*' },
        { name: '🔗 Lien', value: `[Aller au message](${reaction.message.url})` }
      )
      .setTimestamp()
      .setFooter({ text: `Message ID: ${reaction.message.id}` });

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

    // Vérifier si c'est le bon channel
    if (reaction.message.channel.id !== config.channelIdToWatch) return;

    // Vérifier si c'est le dernier message mentionnant le bot
    if (reaction.message.id !== lastBotMentionMessageId) return;

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
        { name: '😀 Réaction', value: reaction.emoji.toString(), inline: true },
        { name: '📊 Total', value: `${reaction.count}`, inline: true },
        { name: '💬 Message', value: reaction.message.content || '*[Message sans texte ou embed]*' },
        { name: '🔗 Lien', value: `[Aller au message](${reaction.message.url})` }
      )
      .setTimestamp()
      .setFooter({ text: `Message ID: ${reaction.message.id}` });

    await logChannel.send({ embeds: [embed] });

  } catch (error) {
    console.error('Erreur lors du traitement de la réaction retirée:', error);
  }
});



// Gestion des erreurs
client.on('error', error => {
  console.error('Erreur du client Discord:', error);
});

// Événement : Commandes slash
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'liste') {
    try {
      if (!lastBotMentionMessageId) {
        return interaction.reply({
          content: '❌ Aucun message mentionnant le bot n\'est actuellement surveillé.',
          ephemeral: true
        });
      }

      await interaction.deferReply();

      const channel = await client.channels.fetch(config.channelIdToWatch);
      const message = await channel.messages.fetch(lastBotMentionMessageId);

      if (!message.reactions.cache.size) {
        return interaction.editReply({
          content: '❌ Le message surveillé n\'a aucune réaction pour le moment.'
        });
      }

      const uniqueUsers = new Set();

      for (const [emoji, reaction] of message.reactions.cache) {
        const users = await reaction.users.fetch();
        users.forEach(user => {
          if (!user.bot) {
            uniqueUsers.add(user);
          }
        });
      }

      const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📋 Liste des Participants')
        .setDescription(`Message surveillé: [Cliquer ici](${message.url})`)
        .addFields({
          name: `👥 Total: ${uniqueUsers.size} utilisateur${uniqueUsers.size > 1 ? 's' : ''}`,
          value: Array.from(uniqueUsers).map(u => `• <@${u.id}> (${u.tag})`).join('\n') || '*Aucun utilisateur*',
          inline: false
        })
        .setTimestamp()
        .setFooter({ text: `Message ID: ${lastBotMentionMessageId}` });

      let reactionDetails = '';
      for (const [emoji, reaction] of message.reactions.cache) {
        const users = await reaction.users.fetch();
        const count = users.filter(u => !u.bot).size;
        reactionDetails += `${emoji} ${count} • `;
      }

      if (reactionDetails) {
        embed.addFields({
          name: '📊 Détail des réactions',
          value: reactionDetails.slice(0, -3),
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Erreur lors de la commande /liste:', error);
      
      if (interaction.deferred) {
        await interaction.editReply({
          content: '❌ Une erreur est survenue lors de la récupération de la liste.'
        });
      } else {
        await interaction.reply({
          content: '❌ Une erreur est survenue lors de la récupération de la liste.',
          ephemeral: true
        });
      }
    }
  }

  // Commande /stats
  if (interaction.commandName === 'stats') {
    try {
      const playerName = interaction.options.getString('joueur') || interaction.user.username;
      const playerData = statsData.players[playerName.toLowerCase()];

      if (!playerData) {
        return interaction.reply({
          content: `❌ Aucune statistique trouvée pour **${playerName}**.`,
          ephemeral: true
        });
      }

      const winrate = playerData.gamesPlayed > 0 
        ? ((playerData.wins / playerData.gamesPlayed) * 100).toFixed(1) 
        : 0;

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`🐺 Stats Loup-Garou - ${playerName}`)
        .addFields(
          { name: '🎮 Parties jouées', value: `${playerData.gamesPlayed}`, inline: true },
          { name: '🎯 Winrate', value: `${winrate}%`, inline: true },
          { name: '⚔️ Kills totaux', value: `${playerData.kills}`, inline: true },
          { name: '🔥 Record de kills', value: `${playerData.bestKills} kills`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'UHC World - Loup-Garou' });

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Erreur lors de la commande /stats:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue.',
        ephemeral: true
      });
    }
  }

  // Commande /classement
  if (interaction.commandName === 'classement') {
    try {
      const sortBy = interaction.options.getString('tri') || 'wins';
      const players = Object.entries(statsData.players);

      if (players.length === 0) {
        return interaction.reply({
          content: '❌ Aucune statistique enregistrée pour le moment.',
          ephemeral: true
        });
      }

      // Trier les joueurs
      players.sort((a, b) => {
        const [nameA, dataA] = a;
        const [nameB, dataB] = b;

        switch (sortBy) {
          case 'kills':
            return dataB.kills - dataA.kills;
          case 'winrate':
            const wrA = dataA.gamesPlayed > 0 ? (dataA.wins / dataA.gamesPlayed) : 0;
            const wrB = dataB.gamesPlayed > 0 ? (dataB.wins / dataB.gamesPlayed) : 0;
            return wrB - wrA;
          default: // wins
            return dataB.wins - dataA.wins;
        }
      });

      const top10 = players.slice(0, 10);
      
      const sortLabels = {
        wins: '🏆 Victoires',
        kills: '⚔️ Kills totaux',
        winrate: '🎯 Winrate'
      };

      let description = '';
      top10.forEach(([name, data], index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        let stat;
        
        switch (sortBy) {
          case 'kills':
            stat = `${data.kills} kills`;
            break;
          case 'winrate':
            const wr = data.gamesPlayed > 0 ? ((data.wins / data.gamesPlayed) * 100).toFixed(1) : 0;
            stat = `${wr}%`;
            break;
          default:
            stat = `${data.wins} victoires`;
        }
        
        description += `${medal} **${name}** - ${stat}\n`;
      });

      const embed = new EmbedBuilder()
        .setColor('#FF6B00')
        .setTitle(`🐺 Classement Loup-Garou - ${sortLabels[sortBy]}`)
        .setDescription(description)
        .setTimestamp()
        .setFooter({ text: `Total: ${players.length} joueur${players.length > 1 ? 's' : ''}` });

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Erreur lors de la commande /classement:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue.',
        ephemeral: true
      });
    }
  }

  // Commande /ajout_partie
  if (interaction.commandName === 'ajout_partie') {
    try {
      const winner = interaction.options.getString('gagnant');
      const playersStr = interaction.options.getString('joueurs');

      // Parser la liste des joueurs (format: Joueur1:3,Joueur2:2,Joueur3:0)
      const playersList = playersStr.split(',').map(p => {
        const [name, kills] = p.trim().split(':');
        return { name: name.trim(), kills: parseInt(kills) || 0 };
      });

      if (playersList.length === 0) {
        return interaction.reply({
          content: '❌ Format invalide. Utilisez: `Joueur1:3,Joueur2:2,Joueur3:0`',
          ephemeral: true
        });
      }

      // Enregistrer la partie
      const gameData = {
        date: new Date().toISOString(),
        winner: winner,
        players: playersList
      };

      statsData.games.push(gameData);

      // Mettre à jour les stats de chaque joueur
      playersList.forEach(player => {
        const pName = player.name.toLowerCase();
        
        if (!statsData.players[pName]) {
          statsData.players[pName] = {
            gamesPlayed: 0,
            wins: 0,
            kills: 0,
            bestKills: 0
          };
        }

        const pData = statsData.players[pName];
        pData.gamesPlayed++;
        pData.kills += player.kills;
        
        if (player.kills > pData.bestKills) {
          pData.bestKills = player.kills;
        }
        
        if (player.name.toLowerCase() === winner.toLowerCase()) {
          pData.wins++;
        }
      });

      saveStats(statsData);

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Partie Loup-Garou enregistrée !')
        .addFields(
          { name: '🏆 Gagnant', value: winner, inline: true },
          { name: '👥 Joueurs', value: `${playersList.length}`, inline: true }
        )
        .setDescription(`**Résultats:**\n${playersList.map(p => `• ${p.name}: ${p.kills} kill${p.kills > 1 ? 's' : ''}`).join('\n')}`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Erreur lors de la commande /ajout_partie:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de l\'ajout de la partie.',
        ephemeral: true
      });
    }
  }
});

process.on('unhandledRejection', error => {
  console.error('Erreur non gérée:', error);
});

// Connexion du bot
client.login(config.token);
