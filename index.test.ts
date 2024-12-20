import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import createFetchMock from 'vitest-fetch-mock'
import {BskyAgent} from '@atproto/api'
import {login} from './bluesky.js'
import {
  handlePayload,
  isSongfishPayload,
  type LambdaEvent,
  type SongfishWebhookPayload,
} from './index.js'
import testFixture from './test-fixture.json'

vi.mock('./bluesky.js') // use e.g.: vi.mocked(login).mockResolvedValue({})

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
      // @ts-expect-error test passing invalid string argument
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
        vi.mocked(login).mockRejectedValue('mocked login failure')
      })
      test('throws with the error message from logging in', async () => {
        await expect(() => handlePayload(payload)).rejects.toThrow('mocked login failure')
      })
    })
    describe('with valid login and prior post does not match latest song title', () => {
      const mockedLoginReturnValue = {
        getAuthorFeed: vi.fn().mockReturnValueOnce({data: {feed: [{post: {record: {text: 'Prior Post'}}}] }}),
      }
      beforeEach(() => {
        vi.mocked(login).mockResolvedValue(mockedLoginReturnValue as unknown as BskyAgent)
      })
      afterEach(() => {
        vi.mocked(login).mockReset()
      })
      describe(`with malformed Latest.json`, () => {
        beforeEach(() => {
          fetchMocker.mockIf(/\bkglw\.net\b.+\blatest\.json$/, () => 'this mocked Songfish response is malformed JSON')
        })
        test('returns a helpful message', async () => {
          await expect(handlePayload(payload)).rejects.toThrow('not valid JSON')
        })
      })
      describe(`when payload's show_id does _not_ match fetched JSON's data[-1].show_id`, () => {
        let mockedPost
        beforeEach(() => {
          mockedPost = vi.fn()
          vi.mocked(login).mockResolvedValue({
            ...mockedLoginReturnValue,
            post: mockedPost,
          } as unknown as BskyAgent)
          mockJson(/\bkglw\.net\b.+\blatest\.json$/, {data: [
            {show_id: 666, songname: 'Most Recent Song Name'},
          ]})
        })
        test('returns a helpful message', async () => {
          await expect(handlePayload(payload)).resolves.toBe(
            'payload show_id does not match latest show'
          )
          expect(mockedPost).not.toHaveBeenCalled()
        })
      })
      describe(`when payload's show_id matches fetched JSON's data[-1].show_id`, () => {
        let mockedPost
        beforeEach(() => {
          mockedPost = vi.fn().mockReturnValueOnce({mocked: true})
          vi.mocked(login).mockResolvedValue({
            ...mockedLoginReturnValue,
            post: mockedPost,
          } as unknown as BskyAgent)
          mockJson(/\bkglw\.net\b.+\blatest\.json$/, {data: [
            {show_id: 789, songname: 'A Different Show and Song'},
            {show_id: 456, songname: 'Yet Another Different Show and Song'},
            {show_id: 123, songname: 'Most Recent Song Name'},
          ]})
        })
        test('posts the song title', async () => {
          await handlePayload(payload)
          expect(mockedPost).toHaveBeenCalledWith({text: 'Most Recent Song Name'})
        })
      })
    })
    describe('with valid login and prior post _does_ match latest song title', () => {
      const mockedLoginReturnValue = {
        getAuthorFeed: vi.fn().mockReturnValueOnce({data: {feed: [{post: {record: {text: 'Song Title'}}}] }}),
      }
      beforeEach(() => {
        vi.mocked(login).mockResolvedValue(mockedLoginReturnValue as unknown as BskyAgent)
      })
      afterEach(() => {
        vi.mocked(login).mockReset()
      })
      describe(`when payload's show_id matches fetched JSON's data[-1].show_id`, () => {
        let mockedPost
        beforeEach(() => {
          mockedPost = vi.fn().mockReturnValueOnce({mocked: true})
          vi.mocked(login).mockResolvedValue({
            ...mockedLoginReturnValue,
            post: mockedPost,
          } as unknown as BskyAgent)
          mockJson(/\bkglw\.net\b.+\blatest\.json$/, {data: [
            {show_id: 123, songname: 'Song Title'},
          ]})
        })
        test('does _not_ post the song title', async () => {
          await handlePayload(payload)
          expect(mockedPost).not.toHaveBeenCalled()
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
    const mockedLoginReturnValue = {
      getAuthorFeed: vi.fn().mockReturnValueOnce({data: {feed: [{post: {record: {text: 'Prior Post'}}}] }}),
    }
    let mockedPost
    beforeEach(() => {
      mockedPost = vi.fn().mockReturnValueOnce({mocked: true})
      vi.mocked(login).mockResolvedValue({
        ...mockedLoginReturnValue,
        post: mockedPost,
      } as unknown as BskyAgent)
      mockJson(/\bkglw\.net\b.+\blatest\.json$/, {data: [
        // the id 1699404057 is defined in the fixture file
        {show_id: 1699404057, songname: 'Name of Song From Show #1699404057'},
      ]})
    })
    afterEach(() => {
      vi.mocked(login).mockReset()
    })
    testWithFixture('does not throw', async ({event}:{event:LambdaEvent<SongfishWebhookPayload>}) => {
      await expect(handlePayload(event)).resolves.not.toThrow()
      expect(mockedPost).toHaveBeenCalledWith({text: 'Name of Song From Show #1699404057'})
    })
  })
})
