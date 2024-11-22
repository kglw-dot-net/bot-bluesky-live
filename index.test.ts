import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import createFetchMock from 'vitest-fetch-mock'
import {BskyAgent} from '@atproto/api'
// import type {PostView} from '@atproto/api/lexicon/types/app/bsky/feed/defs' // TODO arg where is this
import Bluesky from './bluesky.js'
import {
  handlePayload,
  isSongfishPayload,
  type LambdaEvent,
  type SongfishWebhookPayload,
} from './index.js'
import testFixture from './test-fixture.json'

vi.mock('./bluesky.js')

beforeEach(() => {
  vi.clearAllMocks(); // reset before, not after, each test
})

const fetchMocker = createFetchMock(vi)
fetchMocker.enableMocks()

function mockJson(urlMatcher, jsonPayload) {
  fetchMocker.mockIf(urlMatcher, () => ({
    body: JSON.stringify(jsonPayload),
    contentType: 'application/json',
  }))
}

describe('isSongfishPayload', () => {
  test('is a function', () => {
    expect(typeof isSongfishPayload).toBe('function')
  })
  describe('with non-object payload', () => {
    test('is false', () => {
      expect(isSongfishPayload(undefined)).toBe(false)
      expect(isSongfishPayload(9)).toBe(false)
      expect(isSongfishPayload('foo')).toBe(false)
    })
  })
  describe('with object payload', () => {
    describe('when object does not have `body`', () => {
      test('is false', () => {
        expect(isSongfishPayload({foo:'bar'})).toBe(false)
      })
    })
    describe('when object does have `body`', () => {
      describe('but it is not stringified JSON', () => {
        test('is false', () => {
          expect(isSongfishPayload({body:[]})).toBe(false)
        })
      })
      describe('set to stringified JSON', () => {
        describe('when stringified JSON is _not_ an object with a `show_id` key', () => {
          test('is false', () => {
            expect(isSongfishPayload({body:'[1, 2, 3]'})).toBe(false)
            expect(isSongfishPayload({body:'{}'})).toBe(false)
          })
        })
        describe('when stringified JSON _is_ an object with a `show_id` key', () => {
          test('is true', () => {
            expect(isSongfishPayload({body:'{"show_id": 999}'})).toBe(true)
          })
        })
      })
    })
  })
})

describe('handlePayload', () => {
  test('is a function', () => {
    expect(typeof handlePayload).toBe('function')
  })
  describe('with malformed payload', () => {
    test('throws with the error message from parsing the payload', async () => {
      // @ts-expect-error test passing invalid argument
      await expect(() => handlePayload([])).rejects.toThrow('not valid JSON')
    })
  })
  describe('with valid payload', () => {
    let payload
    beforeEach(() => {
      const data = {
        show_id: 123
      }
      payload = {
        body: JSON.stringify(data)
      }
    })
    describe('with invalid login', () => {
      beforeEach(() => {
        vi.mocked(Bluesky.prototype.login).mockRejectedValue('mocked login failure')
      })
      test('throws with the error message from logging in', async () => {
        await expect(() => handlePayload(payload)).rejects.toThrow('mocked login failure')
      })
    })
    describe('with valid login', () => {
      beforeEach(() => {
        vi.mocked(Bluesky.prototype.login).mockResolvedValue()
      })
      describe(`with malformed latest.json`, () => {
        beforeEach(() => {
          fetchMocker.mockIf(/\bkglw\.net\b.+\blatest\.json$/, () => 'this mocked Songfish response is malformed JSON')
        })
        test('returns a helpful message', async () => {
          await expect(handlePayload(payload)).rejects.toThrow('not valid JSON')
        })
      })
      describe('with well-formed latest.json', () => {
        // TODO move mockJson call here instead of more-deeply-nested
        describe('when prior post does NOT match latest song title', () => {
          beforeEach(() => {
            vi.mocked(Bluesky.prototype.getMostRecentPost).mockResolvedValue({post: {
              record: {text: 'Prior Post'}
            } as any})
          })
          describe(`when payload's show_id does _not_ match fetched JSON's data[-1].show_id`, () => {
            let mockRecentPost
            beforeEach(() => {
              mockRecentPost = vi.mocked(Bluesky.prototype.getMostRecentPost).mockResolvedValue({} as any)
              mockJson(/\bkglw\.net\b.+\blatest\.json$/, {data: [
                {show_id: 666, songname: 'Most Recent Song Name'},
              ]})
            })
            afterEach(() => {
              mockRecentPost = null
            })
            test('returns a helpful message', async () => {
              await expect(handlePayload(payload)).resolves.toBe(
                'payload show_id does not match latest show'
              )
              expect(mockRecentPost).not.toHaveBeenCalled()
            })
          })
          describe(`when payload's show_id matches fetched JSON's data[-1].show_id`, () => {
            let mockedPost
            beforeEach(() => {
              vi.mocked(Bluesky.prototype.login).mockResolvedValue()
              vi.mocked(Bluesky.prototype.getMostRecentPost).mockResolvedValue({post: {
                record: {text: 'Prior Song Title'}
              }} as any)
              mockedPost = vi.mocked(Bluesky.prototype.createNewPost).mockResolvedValue({} as any)
              mockJson(/\bkglw\.net\b.+\blatest\.json$/, {data: [
                {show_id: 789, songname: 'Couple Songs Ago'},
                {show_id: 456, songname: 'Prior Song Title'},
                {show_id: 123, songname: 'Newest Song'},
              ]})
            })
            afterEach(() => {
              mockedPost = null
            })
            test('posts the song title (happy path)', async () => {
              await handlePayload(payload)
              expect(mockedPost).toHaveBeenCalledWith('Newest Song')
            })
          })
        })
        describe('when prior post DOES match latest song title', () => {
          let mockedPost
          beforeEach(() => {
            vi.mocked(Bluesky.prototype.getMostRecentPost).mockResolvedValue({post: {
              record: {text: 'The Latest Song'}
            }} as any)
            mockedPost = vi.mocked(Bluesky.prototype.createNewPost).mockResolvedValue({} as any)
            mockJson(/\bkglw\.net\b.+\blatest\.json$/, {data: [
              {show_id: 123, songname: 'The Latest Song'},
            ]})
          })
          afterEach(() => {
            mockedPost = null
          })
          test('does NOT post the song title', async () => {
            await handlePayload(payload)
            expect(mockedPost).not.toHaveBeenCalled()
          })
        })
      })
    })
  })
  describe('with fixture payload matching latest show_id', () => {
    const testWithFixture = test.extend({
      event: async ({}, use) => {
        await use(testFixture.event)
      }
    })
    let mockedPost
    beforeEach(() => {
      vi.mocked(Bluesky.prototype.login).mockResolvedValue()
      vi.mocked(Bluesky.prototype.getMostRecentPost).mockResolvedValue({post: {
        record: {text: 'Prior Post'}
      }} as any)
      mockedPost = vi.mocked(Bluesky.prototype.createNewPost).mockResolvedValue({} as any)
      mockJson(/\bkglw\.net\b.+\blatest\.json$/, {data: [
        // the id 1699404057 is defined in the fixture file
        {show_id: 1699404057, songname: 'Name of Song From Show #1699404057'},
      ]})
    })
    afterEach(() => {
      mockedPost = null
    })
    testWithFixture('does not throw', async ({event}:{event:LambdaEvent<SongfishWebhookPayload>}) => {
      await expect(handlePayload(event)).resolves.not.toThrow()
      expect(mockedPost).toHaveBeenCalledWith('Name of Song From Show #1699404057')
    })
  })
})
