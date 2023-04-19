const { Client } = require('tdl')
const { TDLib } = require('tdl-tdlib-addon')

const client = new Client(new TDLib('/usr/local/lib/libtdjson.so'), {
  apiId: 28578457, // Your api_id, get it at http://my.telegram.org/
  apiHash: '1ac319afbb928a2175c4ac6f30fb7e6c' // Your api_hash
})

client.on('error', console.error)
// client.on('update', update => {
//   console.log('Received update:', update)
// })
const chatId = -1001489061924
// const chatId = 777000
async function main () {
  await client.login()
  // const chats = await client.invoke({
  //   _: 'getChats',
  //   chat_list: { _: 'chatListMain' },
  //   limit: 10
  // })
  const chatInfo = await client.invoke({
    _: 'getChat',
    chat_id: chatId,
  })
  let chatHistory = await client.invoke({
    _: 'getChatHistory',
    chat_id: chatId,
    from_message_id: 642777088,
    limit: 50,
});
  console.log('chatHistory', chatHistory.messages.map(({ content: { text } }) => text))
  // console.log('chatInfo', chatInfo.last_message)

  // ...
}

main().catch(console.error)