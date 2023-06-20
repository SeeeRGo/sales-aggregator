const express = require("express");
const app = express();
const dayjs = require("dayjs");
const dotenv = require("dotenv");
const cors = require('cors');
const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const { createClient } = require('@supabase/supabase-js')

dotenv.config();
const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
const stringSession = new StringSession(process.env.STRING_SESSION); // fill this later with the value from session.save()

const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

// Create a single supabase client for interacting with your database
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);
const getChannelIds = async () => {
  const { data, error } = await supabase.from('channels').select('accessHash,tgChannelId,channelName').eq('isTracked', true)
  if (data) return data
  if (error) {
    console.log('error fetching channels', error);
  }
  return []
}

const parseChannel = ({ tgChannelId, accessHash, channelName }) => ({
  peerId: accessHash ? new Api.InputPeerUser({"userId":BigInt(tgChannelId),"accessHash":BigInt(accessHash)}) : tgChannelId,
  name: channelName
})

const getTrackedChannels = async () => {
  const data = await getChannelIds()
  return data.map(parseChannel)
}

const createMessagesForDB = (messages, chatId, chatName) => messages.map(
  ({
    id,
    date,
    entities,
    message
  }) => {
      const chatIdParsed = chatId instanceof Api.InputPeerUser ? chatId.userId : chatId
      return ({
        tg_message_id: `${id}${chatIdParsed}`, text: message, entities, message_date: date, tg_chat_name: chatName, id
      });
    }
)

const getLatestHistory = async (chatId, chatName) => {
  const fiveMinutes = dayjs().add(-5, "minutes").unix();
  const { messages } = await client.invoke(new Api.messages.GetHistory({
    peer: chatId,
    limit: 50,
  }));
  const latestMessages = createMessagesForDB(messages, chatId, chatName).filter(({ message_date, text }) => text && message_date > fiveMinutes)
  const result = await Promise.all(latestMessages.map(async ({ id, ...rest }) => {
    try {
      const { link } = await client.invoke(new Api.channels.ExportMessageLink({ id, channel: chatId }));
      console.log('link', link);
      return {
        ...rest,
        link,
      }
    } catch (e) {
      console.log('error', e);
      return rest 
    }

  }))
  return result
}
const getFullHistory = async (chatId, chatName) => {
  const monthAgo = dayjs().startOf("day").unix();
  const { messages } = await client.invoke(new Api.messages.GetHistory({
    peer: chatId,
    limit: 300,
  }));
  return createMessagesForDB(messages, chatId, chatName).filter(({ message_date, text }) => text && message_date > monthAgo)
}

async function getCombinedChats() {
  const { chats } = await client.invoke(new Api.channels.GetChannels({ id: chatIds }));
  const users = await client.invoke(new Api.users.GetUsers({ id: userIds}))
  const usersInfo = users.map(({ firstName }, i) => firstName ?? 'Unknown channel ' + i)
  const chatsInfo = chats.map(({ title }) => title)
  const combinedChats = chatsInfo.concat(usersInfo)
  return combinedChats
}

app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(cors());
app.use(express.json());

// app.use((req, res, next) => {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header(
//     "Access-Control-Allow-Headers",
//     "Origin, X-Requested, Content-Type, Accept Authorization"
//   );
//   if (req.method === "OPTIONS") {
//     res.header("Access-Control-Allow-Methods", "POST, PUT, PATCH, GET, DELETE");
//     return res.status(200).json({});
//   }
//   next();
// });

app.get("/chats", async (_, res) => {
    try {
      const result = await client.getDialogs();
      const channels = await getChannelIds();
      const parsedResult = result
        .filter(({ id }) => channels.find(({ tgChannelId }) => `${tgChannelId}` === `${id}`))
        .map(({ id, name, title, entity: { accessHash } }) => ({ id, name, title, accessHash }))

      res.send(parsedResult);
    } catch (e) {
      console.log("error", e);
      res.send({});
    }
})

app.post('/add', async (req, res) => {
  try {
    const result = await client.getDialogs();
    const targetChatName = req.body.chat_name
    const targetShouldTrack = req.body.should_track
    if (targetShouldTrack) {
      const targetChat = result.find(({ name, title }) => name === targetChatName && title === targetChatName)
      if (targetChat) {
        await supabase.from('channels').insert({
          tgChannelId: targetChat.id,
          channelName: targetChat.name,
          channelType: targetChat.isChannel ? 'CHANNEL' : 'BOT',
          accessHash: targetChat.isUser ? targetChat.entity.accessHash : null,
          isTracked: true,
          channelLink: '',
          comment: '',
          upstreamPartners: ''
        })
        res.send('OK')
      } else {
        res.send("Chat not found")
      }
    } else {
      await supabase.from('channels').insert({
        channelName: targetChatName,
        channelType: 'CHAT',
        channelLink: '',
        comment: '',
        upstreamPartners: ''
      })
      res.send('OK')
    }
  } catch (e) {
    console.log("error", e);
    res.send("Something went wrong");
  }
})

app.get("/full", async (_, res) => {
  try {
    const combinedChats = await getCombinedChats()

    let result = []
    for (let i = 0; i < combinedChats.length; i++) {
      const {peerId, name} = combinedChats[i]
      const messages = await getFullHistory(peerId, name);
      result = result.concat(messages)
    }
    for (let i = 0; i < result.length; i++) {
      console.log('upsering', result[i].tg_message_id);
      await supabase.from('messages').insert(result[i])
    }
    res.send('OK');
  } catch (e) {
    console.log("error", e);
    res.send({});
  }
});

// /////////////////////////////////////////////////////////////////////////////
// Catch all handler for all other request.
app.use("*", (req, res) => {
  res.sendStatus(404).end();
});

// /////////////////////////////////////////////////////////////////////////////
// Start the server
const port = process.env.PORT || 5000;
app.listen(port, async () => {
  await client.start({
    phoneNumber: async () => await input.text("Please enter your number: "),
    password: async () => await input.text("Please enter your password: "),
    phoneCode: async () =>
      await input.text("Please enter the code you received: "),
    onError: (err) => console.log(err),
  });
  setInterval(async () => {
    const combinedChats = await getTrackedChannels()

    let result = []
    for (let i = 0; i < combinedChats.length; i++) {
      const {peerId, name} = combinedChats[i]
      const messages = await getLatestHistory(peerId, name);
      result = result.concat(messages)
    }
    for (let i = 0; i < result.length; i++) {
      console.log('upsering', i);
      await supabase.from('messages').upsert(result[i])
    }
  }, 3 * 60 * 1000)
  
  console.log(`index.js listening at http://localhost:${port}`);
});
