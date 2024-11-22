import {BskyAgent} from '@atproto/api'

export default class Bluesky {
  #agent:BskyAgent
  #userID:string
  #password:string

  constructor({userID, password}) {
    this.#userID = userID
    this.#password = password
    this.#agent = new BskyAgent({
      service: 'https://bsky.social',
    })
  }

  async login() {
    await this.#agent.login({
      identifier: this.#userID,
      password: this.#password,
    })
  }

  async getMostRecentPost() {
    const {data: {feed: [mostRecentPost]}} = await this.#agent.getAuthorFeed({actor: this.#userID})
    return mostRecentPost
  }

  async createNewPost(text) {
    return await this.#agent.post({text})
  }
}
