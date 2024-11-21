import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import createFetchMock from 'vitest-fetch-mock'
import {login} from './bluesky'
import {
  handlePayload,
  isSongfishPayload,
  type SongfishWebhookPayload,
} from './index'
import testFixture from './test-fixture.json'

vi.mock('./bluesky') // use e.g.: vi.mocked(login).mockResolvedValue({})

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
  describe('with non-string body', () => {
    test('is false', () => {
      expect(isSongfishPayload()).toBe(false)
      expect(isSongfishPayload(9)).toBe(false)
      expect(isSongfishPayload('foo')).toBe(false)
    })
  })
  describe('with an event object containing "body" property with value of a stringified JSON object', () => {
    const fakeSongfishPayload:SongfishWebhookPayload = {
      body: JSON.stringify({show_id: 'foo'})
    }
    test('retuns true', () => {
      expect(isSongfishPayload(fakeSongfishPayload)).toBe(true)
    })
  })
})

describe('handlePayload', () => {
  test('is a function', () => {
    expect(typeof handlePayload).toBe('function')
  })
  describe('with malformed payload', () => {
    test('throws', async () => {
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
        vi.mocked(login).mockRejectedValue('mocked bluesky.login()')
      })
      test('throws', async () => {
        await expect(() => handlePayload(payload)).rejects.toThrow('mocked bluesky.login()')
      })
    })
    describe('with valid login and prior post does not match latest song title', () => {
      const mockedLoginReturnValue = {
        getAuthorFeed: vi.fn().mockReturnValueOnce({data: {feed: [{post: {record: {text: 'Prior Post'}}}] }}),
      }
      beforeEach(() => {
        vi.mocked(login).mockResolvedValue(mockedLoginReturnValue)
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
          })
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
          })
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
      })
      mockJson(/\bkglw\.net\b.+\blatest\.json$/, {data: [
        // the id 1699404057 is defined in the fixture file
        {show_id: 1699404057, songname: 'Name of Song From Show #1699404057'},
      ]})
    })
    afterEach(() => {
      vi.mocked(login).mockReset()
    })
    testWithFixture('does not throw', async ({event}) => {
      await expect(handlePayload(event)).resolves.not.to.throw()
      expect(mockedPost).toHaveBeenCalledWith({text: 'Name of Song From Show #1699404057'})
    })
  })
})
