import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import createFetchMock from 'vitest-fetch-mock'
import {
  handlePayload,
  isSongfishPayload,
  loginBluesky,
  type SongfishWebhookPayload,
} from './index'

const fetchMocker = createFetchMock(vi)
fetchMocker.enableMocks()

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
        show_id: 'quxxxx'
      }
      payload = {
        body: JSON.stringify(data)
      }
    })
    describe.only('with invalid login', () => {
      beforeEach(() => {
        vi.mock('./index', async (importOriginal) => {
          const originalImplementation = await importOriginal()
          console.log('tryna mock the index import...', originalImplementation)
          return {
            ...originalImplementation,
            loginBluesky: function mockedLoginBluesky() {
              console.log('mocked loginBluesky implementation......')
              throw new Error('mock: loginBluesky failure')
            },
          }
        });
      })
      test.skip('(SKIPPED: old implementation) resolves with a message', async () => {
        await expect(handlePayload(payload)).resolves.toMatch(/foooooo/)
      })
      test('throws', async () => {
        await expect(() => handlePayload(payload)).rejects.toThrow()
      })
    })
    describe('with valid login', () => {
      beforeEach(() => {
        vi.mock('loginBluesky', {
          getAuthorFeed: 'foo' //vi.fn({authorFeedData:'this is mocked author feed data'})
        })
      })
      describe(`with invalid payload`, () => {
        beforeEach(() => {
          fetchMocker.mockIf(/\bkglw\.net\b.+\blatest\.json$/, () => 'mocked Songfish payload is malformed')
        })
        test('returns a helpful message', async () => {
          await expect(handlePayload({body:JSON.stringify({show_id:123})})).resolves.toBe(
            'payload show_id does not match latest show'
          )
        })
      })
      describe(`when payload's show_id does _not_ match fetched JSON's data[0].show_id`, () => {
        beforeEach(() => {
          fetchMocker.mockIf(/\bkglw\.net\b.+\blatest\.json$/, () => ({data: [
            {show_id: 666, songname: 'Most Recent Song Name'},
            {foo: 'bar'},
            {foo: 'baz'},
            {foo: 'qux'},
          ]}))
        })
        test('returns a helpful message', async () => {
          await expect(handlePayload({body:JSON.stringify({show_id:123})})).resolves.toBe(
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
          await expect(handlePayload({body:JSON.stringify({show_id:123})})).resolves.toBe(
            'whattttt'
          )
        })
      })
    })
  })
})
