import * as process from 'process'

export async function login():Promise<BskyAgent> {
  console.log('... this is THE REAL login ...')
  const agent = new BskyAgent({
    service: 'https://bsky.social',
  })
  await agent.login({
    identifier: process.env.BLUESKY_USERNAME!,
    password: process.env.BLUESKY_PASSWORD!,
  })
  return agent
}
