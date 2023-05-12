const express = require("express");
const app = express();
const dayjs = require("dayjs");
const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const { message } = require("telegram/client");

const apiId = process.env.API_ID;
const apiHash = process.env.API_HASH;
const stringSession = new StringSession(process.env.STRING_SESSION); // fill this later with the value from session.save()

const chatIds = [
  -1001254597341, -1001259051878, -1001478880423, -1001489061924,
  -1001211051969, -1001306794802, -1001773534346, -1001315524793,
  -1001332690767, -1001294009783, //5377945958, -1001512507088, // 5357693474,
  -1001244373622, -1001076312571, -1001612984186, -1001570400379,
  -1001120611331, -1001727398064, -1001666172044, -1001139345092,
  -1001516827892, -1001684315574, -1001527372844, -1001284121152,
  -1001445071488, -1001548632083, -1001403624445, -1001706094161,
  -1001376858073, -1001391497838, -1001391347473, -1001502018760,
  -1001211051969, -1001751281898, -1001357786906, -1001451069977,
  // -1001080132414, // Засирает ленту просто сообщениями
  -1001987345789,
];

// const accessHashes = [-6834854159469753124, -6055207872981864269, 8050414125024882872, 2071332180262217027, 2219870631779647460, -6273813176736408380,-5920906890419123166,-7810775977581075226,6053859012847446570,8687262491798429562,5233860802200827946,-505664746947020117,4221985370143303253,610250252856290507,8364562225157752385,3267768143761883883,5615007317366749093,-6372466980253608032,1438853615417610124,-7271687720081094371,1190566383691495979,844794807331127875,-3767227939808568650,-5922685839852522654,-2666691390116925434,-6434053341823851427,6403435223049717511,6588512478603116857,4180695193341251330,5661531200345590951,7747668825449114971,-5966010701022667524,-1619032134680908706,8761032431890758820]

// const chatIds = ["1254597341","1259051878","1478880423","1489061924","1211051969","1306794802","1773534346","1315524793","1332690767","1294009783","1244373622","1076312571","1612984186","1570400379","1120611331","1727398064","1666172044","1139345092","1516827892","1684315574","1527372844","1284121152","1445071488","1548632083","1403624445","1706094161","1376858073","1391497838","1391347473","1502018760","1751281898","1357786906","1451069977","1987345789"]
const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

const getChatHistoryFromDate = async (chatId, startDate, endDate) => {
  const { messages } = await client.invoke(new Api.messages.GetHistory({
    peer: chatId,
    limit: 100,
    offsetDate: endDate,
  }));
  const result = messages
    .filter(({ date, message }) => message && date > startDate)
    .map(
      ({
        id,
        date,
        entities,
        message
      }) => ({ messageId: `${id}${chatId}`, text: message, entities, date })
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
  const { chats } = await client.invoke(new Api.channels.GetChannels({ id: chatIds }));
  const chatsInfo = chats.map(({ title }) => title)

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
    lastDayMessages,
    olderMessages,
    chatsInfo,
  };
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
