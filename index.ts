import Bluesky from './bluesky.js'

export type LambdaEvent<T> = {
  body: string // ... which is JSON that parses into a type T
}
export type SongfishWebhookPayload = {
  show_id: number
}

export function isSongfishPayload(event:any):event is LambdaEvent<SongfishWebhookPayload> {
  return typeof event?.body === 'string' && event.body.includes('"show_id"')
  // TODO could further verify that the song_id appears to be an int...
}

export async function handlePayload(event:LambdaEvent<SongfishWebhookPayload>):Promise<string|Record<string, any>> {
  let payloadBody:SongfishWebhookPayload
  try {
    payloadBody = JSON.parse(event.body)
  } catch (err) {
    console.log('error parsing event body:', err)
    throw err
  }
  let bsky = new Bluesky({
    userID: process.env.BLUESKY_USERNAME!,
    password: process.env.BLUESKY_PASSWORD!,
  })
  try {
    await bsky.login()
  } catch (err) {
    console.log('login error:', err)
    throw err
  }
  let latestData
  try {
    latestData = (await (await fetch('https://kglw.net/api/v2/latest.json')).json()).data
  } catch (err) {
    console.log('latest json error:', err)
    throw err
  }
  const lastSongInLatestShow = latestData.slice(-1)[0]
  if (payloadBody.show_id !== lastSongInLatestShow.show_id) {
    console.log(`payload show_id ${payloadBody.show_id} does not match latest show ${lastSongInLatestShow.show_id}`)
    return 'payload show_id does not match latest show'
  }
  let lastPost
  try {
    lastPost = await bsky.getMostRecentPost()
  } catch (err) {
    console.log('error fetching most recent post...:', err)
    throw err
  }
  if (lastPost.post.record.text === lastSongInLatestShow.songname) {
    console.log('most recent post is already about this song...')
    return 'most recent post is already about this song...'
  }
  const text = lastSongInLatestShow.songname
  const postResponse = await bsky.createNewPost(text)
  console.log('Just posted!', postResponse)
  return postResponse
}

export const handler = async (event:unknown):Promise<{statusCode:number,body:string}> => {
  let statusCode, body
  if (isSongfishPayload(event)) {
    try {
      statusCode = 200
      body = await handlePayload(event)
    } catch (err) {
      console.log('error in handler:', err)
      statusCode = 500
      body = JSON.stringify(err)
    }
  } else {
    statusCode = 400
    body = `unexpected payload... typeof event: ${typeof event}`
  }
  return {statusCode, body}
}
