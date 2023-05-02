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
  -1001489061924,
  -1001259051878,
  -1001306794802,
  -1001211051969,
];
// const chatId = 777000
const getChatHistoryFromDate = async (chatId, startDate, endDate) => {
  const { id: latestTimeframeMessageId } = await client.invoke({
    _: "getChatMessageByDate",
    chat_id: chatId,
    date: endDate,
  });
  const { messages } = await client.invoke({
    _: "getChatHistory",
    chat_id: chatId,
    from_message_id: latestTimeframeMessageId,
    limit: 100,
    offset: -1,
  });
  const result = messages
  .filter(({ date, content: { text } }) => text && date > startDate)
  .map(
    ({
      date,
      content: {
        text: { text, entities },
      },
    }) => ({ text, entities, date })
  )
  return  result
}

async function getMessages() {
  // await client.login(); // UNCOMMENT FOR INITIAL START
  const chats = await client.invoke({
    _: "getChats",
    chat_list: { _: "chatListMain" },
    limit: 40,
  }); // UNCOMMENT FOR INITIAL START TOO
  const chatsInfo = [];
  for(let i = 0; i < chatIds.length; i++) {
    const chatInfo = await client.invoke({
      _: "getChat",
      chat_id: chatIds[i],
    });
    chatsInfo.push(chatInfo.title)
  }

  // GET ALL TODAY'S MESSAGES FOR EVERY CHAT
  const lastHourMessages = [];
  const lastFourHourMessages = [];
  const lastDayMessages = [];
  const olderMessages = [];
  for (let i = 0; i < chatIds.length; i++) {
    const hourAgo = dayjs().add(-1, "hour").unix();
    const fourHoursAgo = dayjs().add(-4, "hour").unix();
    const dayAgo = dayjs().add(-1, "day").unix();
    const monthAgo = dayjs().add(-1, "month").startOf("day").unix();
    const lastHourHistory = await getChatHistoryFromDate(chatIds[i], hourAgo, dayjs().unix())
    const lastFourHoursHistory = await getChatHistoryFromDate(chatIds[i], fourHoursAgo, hourAgo)
    const lastDayHistory = await getChatHistoryFromDate(chatIds[i], dayAgo, fourHoursAgo)
    const olderHistory = await getChatHistoryFromDate(chatIds[i], monthAgo, dayAgo)
    
    lastHourMessages.push(lastHourHistory.map(res => ({ ...res, chatName: chatsInfo[i] })));

    lastFourHourMessages.push(lastFourHoursHistory.map(res => ({ ...res, chatName: chatsInfo[i] })));

    lastDayMessages.push(lastDayHistory.map(res => ({ ...res, chatName: chatsInfo[i] })));

    olderMessages.push(olderHistory.map(res => ({ ...res, chatName: chatsInfo[i] })));
  }

  return {
    lastHourMessages,
    lastFourHourMessages,
    lastDayMessages,
    olderMessages,
    chatsInfo,
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
    res.send(messages);
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
