import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import createFetchMock from 'vitest-fetch-mock'
import {login} from './bluesky'
import {
  handlePayload,
  isSongfishPayload,
  type SongfishWebhookPayload,
} from './index'

console.log('...tryna mock login().....')
vi.mock('./bluesky', async (importOriginal) => ({
  ...(await importOriginal()),
  login: function mockedLoginBluesky() {
    console.log('!! mocked loginBluesky implementation......')
    throw new Error('mock: loginBluesky failure')
  },
}
                                               ));

const fetchMocker = createFetchMock(vi)
fetchMocker.enableMocks()
console.log('mocks: fetch mock enabled')
// function mockJson(urlMatcher, jsonPayload) {
//   console.log('mocks: fetch mock if', urlMatcher)
//   fetchMocker.mockIf(urlMatcher, () => ({
//     body: JSON.stringify(jsonPayload),
//     contentType: 'application/json',
//   }))
// }

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
      await expect(() => handlePayload({body: '{foo'})).rejects.toThrow(/JSON/)
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
        // TODO
      })
      test('throws', async () => {
        console.log('okay now here comes the expect()...')
        await expect(() => handlePayload(payload)).rejects.toThrow('mock: loginBluesky failure')
      })
    })
    describe.todo('with valid login', () => {
      beforeEach(() => {
        // TODO
      })
      describe.skip(`with malformed Latest.json`, () => {
        beforeEach(() => {
          fetchMocker.mockIf(/\bkglw\.net\b.+\blatest\.json$/, () => 'this mocked Songfish response is malformed JSON')
        })
        test('returns a helpful message', async () => {
          await expect(handlePayload(payload)).resolves.toBe(
            'payload show_id does not match latest show'
          )
        })
      })
      describe(`when payload's show_id does _not_ match fetched JSON's data[0].show_id`, () => {
        beforeEach(() => {
          // mockJson(/\bkglw\.net\b.+\blatest\.json$/, {data: [
          //   {show_id: 666, songname: 'Most Recent Song Name'},
          //   {foo: 'bar'},
          //   {foo: 'baz'},
          //   {foo: 'qux'},
          // ]})
        })
        test('returns a helpful message', async () => {
          await expect(handlePayload(payload)).resolves.toBe(
            'payload show_id does not match latest show'
          )
        })
      })
      describe(`when payload's show_id matches fetched JSON's data[0].show_id`, () => {
        beforeEach(() => {
          fetchMocker.mockIf(/kglw/, () => ({data: [
            {show_id: 123, songname: 'Most Recent Song Name'},
            {foo: 'bar'},
            {foo: 'baz'},
            {foo: 'qux'},
          ]}))
        })
        test('does something useful', async () => {
          await expect(handlePayload(payload)).resolves.toBe(
            'whattttt'
          )
        })
      })
    })
  })
  describe.todo('with fixture payload')
})
