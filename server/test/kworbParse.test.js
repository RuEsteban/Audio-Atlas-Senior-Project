import test from 'node:test'
import assert from 'node:assert/strict'
import { parseKworbTokenLines } from '../src/services/chartAggregationService.js'

test('parseKworbTokenLines parses rank/title/artist/streams and kworb_chart_date', () => {
    const lines = [
        'Spotify Daily Chart - United States - 2026/03/02 | Totals',
        'PosP+Artist and TitleDaysPk(x?)StreamsStreams+7Day7Day+Total',
        '1',
        '=',
        'Bruno Mars - Risk It All',
        '4',
        '1(x4)',
        '1,884,646',
        '+349,026',
        '7,718,469',
        '2',
        '=',
        'PinkPantheress - Stateside + Zara Larsson (w/ Zara Larsson)',
        '1',
        '1(x1)',
        '1,234,567'
    ]

    const { rows, kworb_chart_date } = parseKworbTokenLines(lines, { limit: 2 })

    assert.equal(kworb_chart_date, '2026-03-02')
    assert.equal(rows.length, 2)

    assert.deepEqual(rows[0], {
        rank: 1,
        trackName: 'Risk It All',
        artistName: 'Bruno Mars',
        streams: 1884646
    })

    assert.equal(rows[1].rank, 2)
    assert.equal(rows[1].artistName, 'PinkPantheress')
    assert.ok(rows[1].trackName.startsWith('Stateside'))
    assert.equal(rows[1].streams, 1234567)
})