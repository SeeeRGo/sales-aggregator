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

const chatIds = [
  -1001254597341,
  -1001259051878,
  -1001478880423,
  -1001489061924,
  -1001211051969,
  -1001306794802,
  -1001773534346,
  -1001289197989,
  -1001315524793,
  -1001332690767,
  -1001795499242,
  -1001517966409,
  -1001294009783,
  -1001518770876,
  -1001949901742,
  -1001512507088,
  -1001656664424,
  -1001244373622,
  -1001076312571,
  -1001612984186,
  -1001570400379,
  -1001120611331,
  -1001727398064,
  -1001666172044,
  -1001139345092,
  -1001516827892,
  -1001684315574,
  -1001513463322,
  -1001527372844,
  -1001522971705,
  -1001284121152,
  -1001445071488,
  -1001548632083,
  -1001403624445,
  -1001859586999,
  -1001201636422,
  -1001857651809,
  -1001706094161,
  -1001376858073,
  -1001890913210,
  -1001391497838,
  -1001391347473,
  -1001502018760,
  -1001625727469,
  -1001669423143,
  -1001751281898,
  -1001357786906,
  -1001451069977,
  -1001987345789,
  -1001594836876,
  -1001589732488,
  -1001521293710,
  -1001803850016,
];
const userIds = [
  new Api.InputPeerUser({"userId":BigInt("5377945958"),"accessHash":BigInt("-6137347072698466900")}),
  new Api.InputPeerUser({"userId":BigInt("5357693474"),"accessHash":BigInt("1864063971774782801")}),
  new Api.InputPeerUser({"userId":BigInt("5709595227"),"accessHash":BigInt("9025693265906860855")}),
  new Api.InputPeerUser({"userId":BigInt("5596230697"),"accessHash":BigInt("1733381136733274207")}),
  new Api.InputPeerUser({"userId":BigInt("5029183441"),"accessHash":BigInt("4467967627617849310")}),
]

const combinedIds = chatIds.concat(userIds)

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
    const result = await getCombinedChats();
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
app.get('/update', async (req, res) => {
  try {
    for(let i = 0; i < userIds.length; i++) {
      const { userId, accessHash } = userIds[i]
      await supabase
        .from('channels')
        .update({ accessHash: `${accessHash}` })
        .eq('tgChannelId', userId)
    }
    res.send('OK')
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
