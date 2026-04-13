import pricingJson from '../cost/pricing.json'
import type { PricingTable } from '../cost/types'

describe('bundled pricing table', () => {
  const pricing = pricingJson as PricingTable

  it('contains claude-sonnet-4-6', () => {
    expect(pricing['claude-sonnet-4-6']).toBeDefined()
    expect(pricing['claude-sonnet-4-6'].input_cost_per_token).toBeGreaterThan(0)
  })

  it('contains claude-opus-4-6', () => {
    expect(pricing['claude-opus-4-6']).toBeDefined()
    expect(pricing['claude-opus-4-6'].output_cost_per_token).toBeGreaterThan(0)
  })

  it('contains claude-haiku-4-5', () => {
    expect(pricing['claude-haiku-4-5']).toBeDefined()
  })

  it('every entry has all four cost fields', () => {
    for (const [name, info] of Object.entries(pricing)) {
      expect(info.input_cost_per_token, `${name} input`).toBeGreaterThan(0)
      expect(info.output_cost_per_token, `${name} output`).toBeGreaterThan(0)
      // Cache fields may not exist for very old models but all current ones have them
      if (info.cache_creation_input_token_cost !== undefined) {
        expect(info.cache_creation_input_token_cost, `${name} cache create`).toBeGreaterThanOrEqual(0)
      }
      if (info.cache_read_input_token_cost !== undefined) {
        expect(info.cache_read_input_token_cost, `${name} cache read`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('opus is more expensive than sonnet, sonnet more than haiku (input)', () => {
    const opus = pricing['claude-opus-4-6'].input_cost_per_token ?? 0
    const sonnet = pricing['claude-sonnet-4-6'].input_cost_per_token ?? 0
    const haiku = pricing['claude-haiku-4-5'].input_cost_per_token ?? 0
    expect(opus).toBeGreaterThan(sonnet)
    expect(sonnet).toBeGreaterThan(haiku)
  })

  it('cache-read is cheaper than cache-create for every model that has both', () => {
    for (const [name, info] of Object.entries(pricing)) {
      if (info.cache_creation_input_token_cost && info.cache_read_input_token_cost) {
        expect(
          info.cache_read_input_token_cost,
          `${name}: cache-read should be cheaper than cache-create`,
        ).toBeLessThan(info.cache_creation_input_token_cost)
      }
    }
  })
})
