import * as process from 'process'
import {BskyAgent} from '@atproto/api'

export async function login():Promise<BskyAgent> {
  const agent = new BskyAgent({
    service: 'https://bsky.social',
  })
  await agent.login({
    identifier: process.env.BLUESKY_USERNAME!,
    password: process.env.BLUESKY_PASSWORD!,
  })
  return agent
}
