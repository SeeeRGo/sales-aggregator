const express = require('express')
const app = express()
const dotenv = require("dotenv");
const dayjs = require("dayjs");
const { Client } = require("tdl");
const { TDLib } = require("tdl-tdlib-addon");

dotenv.config();
const client = new Client(
  new TDLib(process.env.LIB_PATH),
  {
    apiId: 28578457, // Your api_id, get it at http://my.telegram.org/
    apiHash: "1ac319afbb928a2175c4ac6f30fb7e6c", // Your api_hash
  }
);

client.on("error", console.error);
// client.on('update', update => {
//   console.log('Received update:', update)
// })
const chatIds = [
  -1001489061924, -1001259051878, -1001306794802, -1001211051969,
];
// const chatId = 777000
async function getMessages() {
  // await client.login(); UNCOMMENT FOR INITIAL START
  // const chats = await client.invoke({
  //   _: "getChats",
  //   chat_list: { _: "chatListMain" },
  //   limit: 20,
  // });
  // const chatsInfo = [];
  // for(let i = 0; i < chatIds.length; i++) {
  //   const chatInfo = await client.invoke({
  //     _: "getChat",
  //     chat_id: chatIds[i],
  //   });
  //   chatsInfo.push(chatInfo)
  // }

  // GET LATEST YESTERDAY'S MESSAGE FOR EVERY CHAT
  const todayMessageIds = [];
  const lastWeekMessageIds = [];
  for (let i = 0; i < chatIds.length; i++) {
    const todayEnd = dayjs().endOf("day").unix();
    const yesterdayEnd = dayjs().add(-1, "day").endOf("day").unix();
    const { id } = await client.invoke({
      _: "getChatMessageByDate",
      chat_id: chatIds[i],
      date: todayEnd,
    });
    const { id: yesterdayMessageId } = await client.invoke({
      _: "getChatMessageByDate",
      chat_id: chatIds[i],
      date: yesterdayEnd,
    });
    todayMessageIds.push(id);
    lastWeekMessageIds.push(yesterdayMessageId);
  }

  // GET ALL TODAY'S MESSAGES FOR EVERY CHAT
  const todayMessages = [];
  const lastWeekMessages = [];
  for (let i = 0; i < chatIds.length; i++) {
    const yesterdayEnd = dayjs().add(-1, "day").endOf("day").unix();
    const weekAgo = dayjs().add(-1, "week").startOf("day").unix();
    const { messages: todayHistory } = await client.invoke({
      _: "getChatHistory",
      chat_id: chatIds[i],
      from_message_id: todayMessageIds[i],
      limit: 100,
    });
    const { messages: lastWeekHistory } = await client.invoke({
      _: "getChatHistory",
      chat_id: chatIds[i],
      from_message_id: lastWeekMessageIds[i],
      limit: 100,
    });
    todayMessages.push(
      todayHistory
        .filter(({ date, content: { text } }) => text && date > yesterdayEnd)
        .map(
          ({
            date,
            content: {
              text: { text },
            },
          }) => ({ text, date })
        )
    );
    lastWeekMessages.push(
      lastWeekHistory
        .filter(({ date, content: { text } }) => text && date > weekAgo)
        .map(
          ({
            date,
            content: {
              text: { text },
            },
          }) => ({ text, date })
        )
    );
  }

  return {
    todayMessages,
    lastWeekMessages,
  };
  // await client.close()
}

app.use(
    express.urlencoded({
      extended: true
    })
  )
  
app.use(express.json())

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*")
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested, Content-Type, Accept Authorization"
    )
    if (req.method === "OPTIONS") {
      res.header(
        "Access-Control-Allow-Methods",
        "POST, PUT, PATCH, GET, DELETE"
      )
      return res.status(200).json({})
    }
    next()
  })

app.get('/', async (_, res) => {
  try {
    const messages = await getMessages()
    console.log('messages');
    res.send(messages);
    console.log('sent messages');
  } catch (e) {
    console.log('error', e);
    res.send({})
  }
})

// /////////////////////////////////////////////////////////////////////////////
// Catch all handler for all other request.
app.use('*', (req,res) => {
  res.sendStatus(404).end()
})

// /////////////////////////////////////////////////////////////////////////////
// Start the server
const port = process.env.PORT || 5000
app.listen(port, () => {
  console.log(`index.js listening at http://localhost:${port}`)
})
