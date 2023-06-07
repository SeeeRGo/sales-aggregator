// Канал IT Test || Partners
const express = require("express");
const app = express();
const dayjs = require("dayjs");
const dotenv = require("dotenv");
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

app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested, Content-Type, Accept Authorization"
  );
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Methods", "POST, PUT, PATCH, GET, DELETE");
    return res.status(200).json({});
  }
  next();
});

// app.get("/", async (_, res) => {
//   try {
//     const chats = await getCombinedChats()
//     res.send(chats.map(chatId => ({
//           old: chatId instanceof Api.InputPeerUser ? chatId.userId : chatId,
//           new:  typeof chatId === 'object' && 'userId' in chatId ? chatId.userId : chatId
//     })));
//   } catch (e) {
//     console.log("error", e);
//     res.send({});
//   }
// });

app.post('/add', async (req, res) => {
  try {
    const result = await client.getDialogs();
    const targetChatName = req.body.chat_name
    const targetChat = result.find(({ name, title }) => name === targetChatName && title === targetChatName)
    if (targetChat) {
      res.send({
        id: targetChat.id, name: targetChat.name, title: targetChat.title, accessHash: targetChat.entity.accessHash
      })
    } else {
      res.send("Chat not found")
    }
  } catch (e) {
    console.log("error", e);
    res.send("Something went wrong");
  }
})

app.get("/chats", async (_, res) => {
    try {
      const result = await client.getDialogs();
      const parsedResult = result
        .filter(({ id }) => userIds.find(user => `${id}` === `${user.userId}`) || chatIds.find(chatId => `${chatId}` === `${id}`))
        .map(({ id, name, title, entity: { accessHash } }) => ({ id, name, title, accessHash }))

      res.send(parsedResult);
    } catch (e) {
      console.log("error", e);
      res.send({});
    }
})

app.get("/full", async (_, res) => {
  try {
    const combinedChats = await getCombinedChats()

    let result = []
    for (let i = 0; i < combinedIds.length; i++) {
      const messages = await getFullHistory(combinedIds[i], combinedChats[i]);
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
  console.log(`index.js listening at http://localhost:${port}`);
});
