import * as dotenv from 'dotenv'
import * as process from 'process'
import {login} from './bluesky.js'

dotenv.config() // read env var declarations from a `.env` file

export type LambdaEvent<T> = {
  body: string // ... which is JSON that parses into a type T
}
export type SongfishWebhookPayload = {
  show_id: number
}

export type BlueskyAgent = {
  getAuthorFeed: Function
  post: Function
}

export function isSongfishPayload(event:any):event is LambdaEvent<SongfishWebhookPayload> {
  return typeof event?.body === 'string' && event.body.includes('"show_id"')
  // TODO could further verify that the song_id appears to be an int...
}

export async function handlePayload(event:LambdaEvent<SongfishWebhookPayload>):Promise<string> {
  let payloadBody:SongfishWebhookPayload
  try {
    payloadBody = JSON.parse(event.body)
  } catch (err) {
    console.log('error parsing event body', err)
    throw err
  }
  let bsky:BlueskyAgent
  try {
    bsky = await login()
  } catch (err) {
    console.log('login error', err)
    throw err
  }
  let latestData
  try {
    latestData = (await (await fetch('https://kglw.net/api/v2/latest.json')).json()).data
  } catch (err) {
    console.log('latest json error', err)
    throw err
  }
  const lastSongInLatestShow = latestData.slice(-1)[0]
  if (payloadBody.show_id !== lastSongInLatestShow.show_id) {
    console.log(`payload show_id ${payloadBody.show_id} does not match latest show ${lastSongInLatestShow.show_id}`)
    return 'payload show_id does not match latest show'
  }
  let lastPost
  try {
    const feed = await bsky.getAuthorFeed({actor: process.env.BLUESKY_USERNAME}) // TODO extract this into bluesky file as well
    lastPost = feed.data.feed[0]
  } catch (err) {
    console.log('error fetching most recent post...', err)
    throw err
  }
  if (lastPost.post.record.text === lastSongInLatestShow.songname) {
    console.log('most recent post is already about this song...')
    return 'most recent post is already about this song...'
  }
  const text = lastSongInLatestShow.songname
  const postResponse = await bsky.post({text})
  console.log('Just posted!', postResponse)
  return postResponse
}

export const handler = async (event:SongfishWebhookPayload|unknown):Promise<{statusCode:number,body:string}> => {
  if (!isSongfishPayload(event))
    return {
      statusCode: 400,
      body: `unexpected payload... typeof event: ${typeof event}`,
    }
  try {
    return {
      statusCode: 200,
      body: await handlePayload(event)
    }
  } catch (err) {
    console.log(err)
    return {
      statusCode: 500,
      body: JSON.stringify(err),
    }
  }
}
