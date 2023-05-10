const express = require("express");
const app = express();
const dotenv = require("dotenv");
const dayjs = require("dayjs");
const { Client } = require("tdl");
const { TDLib } = require("tdl-tdlib-addon");

dotenv.config();
const client = new Client(new TDLib(process.env.LIB_PATH), {
  apiId: 28578457, // Your api_id, get it at http://my.telegram.org/
  apiHash: "1ac319afbb928a2175c4ac6f30fb7e6c", // Your api_hash
});

client.on("error", console.error);
// client.on('update', update => {
//   console.log('Received update:', update)
// })
const chatIds = [
  -1001254597341, -1001259051878, -1001478880423, -1001489061924,
  -1001211051969, -1001306794802, -1001773534346, -1001315524793,
  -1001332690767, -1001294009783, 5377945958, -1001512507088, 5357693474,
  -1001244373622, -1001076312571, -1001612984186, -1001570400379,
  -1001120611331, -1001727398064, -1001666172044, -1001139345092,
  -1001516827892, -1001684315574, -1001527372844, -1001284121152,
  -1001445071488, -1001548632083, -1001403624445, -1001706094161,
  -1001376858073, -1001391497838, -1001391347473, -1001502018760,
  -1001211051969, -1001751281898, -1001357786906, -1001451069977,
  // -1001080132414, // Засирает ленту просто сообщениями
  -1001987345789,
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
        id,
        chat_id,
        date,
        content: {
          text: { text, entities },
        },
      }) => ({ messageId: `${id}${chatId}`, text, entities, date })
    );
  return result;
};

async function getMessages() {
  // await client.login(); // UNCOMMENT FOR INITIAL START
  // const chats = await client.invoke({
  //   _: "getChats",
  //   chat_list: { _: "chatListMain" },
  //   limit: 99,
  // }); // UNCOMMENT FOR INITIAL START TOO
  const chatsInfo = [];
  for (let i = 0; i < chatIds.length; i++) {
    const { id, title } = await client.invoke({
      _: "getChat",
      chat_id: chatIds[i],
    });
    chatsInfo.push(title);
  }

  // GET ALL TODAY'S MESSAGES FOR EVERY CHAT
  let lastHourMessages = [];
  let lastFourHourMessages = [];
  let lastDayMessages = [];
  let olderMessages = [];
  for (let i = 0; i < chatIds.length; i++) {
    const hourAgo = dayjs().add(-1, "hour").unix();
    const fourHoursAgo = dayjs().add(-4, "hour").unix();
    const dayAgo = dayjs().add(-1, "day").unix();
    const monthAgo = dayjs().add(-1, "month").startOf("day").unix();
    const lastHourHistory = await getChatHistoryFromDate(
      chatIds[i],
      hourAgo,
      dayjs().unix()
    );
    const lastFourHoursHistory = await getChatHistoryFromDate(
      chatIds[i],
      fourHoursAgo,
      hourAgo
    );
    const lastDayHistory = await getChatHistoryFromDate(
      chatIds[i],
      dayAgo,
      fourHoursAgo
    );
    const olderHistory = await getChatHistoryFromDate(
      chatIds[i],
      monthAgo,
      dayAgo
    );

    lastHourMessages = lastHourMessages.concat(
      lastHourHistory.map((res) => ({ ...res, chatName: chatsInfo[i] }))
    );

    lastFourHourMessages = lastFourHourMessages.concat(
      lastFourHoursHistory.map((res) => ({ ...res, chatName: chatsInfo[i] }))
    );

    lastDayMessages = lastDayMessages.concat(
      lastDayHistory.map((res) => ({ ...res, chatName: chatsInfo[i] }))
    );

    olderMessages = olderMessages.concat(
      olderHistory.map((res) => ({ ...res, chatName: chatsInfo[i] }))
    );
  }

  return {
    lastHourMessages,
    lastFourHourMessages,
    lastDayMessages: [],
    olderMessages: [],
    chatsInfo,
  };
  // await client.close()
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

app.get("/", async (_, res) => {
  try {
    const messages = await getMessages();
    res.send(messages);
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
app.listen(port, () => {
  console.log(`index.js listening at http://localhost:${port}`);
});
