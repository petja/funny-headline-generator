const Parser = require('rss-parser')
const parser = new Parser()

const START_OF_TITLE = '__START_OF_TITLE__'
const END_OF_TITLE = '__END_OF_TITLE__'

// Retrieve articles from various news sources
const getFeedItems = async () => {
  const articlesByFeed = (await Promise.all(
    [
      'http://www.seiska.fi/rss/viihdeuutiset.rss',
      'https://seura.fi/feed/',
      'https://suomenkuvalehti.fi/8hj38g7dh49g73jd02fasd/',
      'https://feeds.yle.fi/uutiset/v1/recent.rss?publisherIds=YLE_UUTISET',
      'https://hymy.fi/feed/',
      'https://www.hs.fi/rss/tuoreimmat.xml',
      'https://www.iltalehti.fi/rss.xml',
      'https://www.is.fi/rss/tuoreimmat.xml',
      'https://www.mtv.fi/api/feed/rss/uutiset_uusimmat',
    ].map(url => parser.parseURL(url))
  )).map(feed => feed.items)

  return [].concat(...articlesByFeed)
}

// Process article titles
const getArticleTitles = articles =>
  articles.map(article =>
    article.title
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2012\u2013\u2014\u2015\u2053]/g, '-')
      .replace(/\(€\) \#.*/g, '')
      .replace(/\s/g, ' ')
      .trim()
  )

// Create table from probabilities
// Which words comes most often after another
const generateProbabilityTable = titles =>
  titles.reduce(
    (acc, title) => {
      // Get all words of the title
      const words = title.split(/\s/)
      const firstWord = words[0]

      // Collect all words which may start the title
      if (!acc[START_OF_TITLE][firstWord]) {
        acc[START_OF_TITLE][firstWord] = 0
      }

      acc[START_OF_TITLE][firstWord]++

      // Loop thu each word
      words.forEach((word, wordIndex) => {
        // Keep track which words are most often used to end the headline
        const next = words[wordIndex + 1] || END_OF_TITLE

        if (!acc[word]) acc[word] = {}
        if (!acc[word][next]) acc[word][next] = 0

        acc[word][next]++
      })

      return acc
    },
    { [START_OF_TITLE]: {} }
  )

// Decompress object
// {"A": 3, "B": 2, "C": 1}
// to array like
// ["A", "A", "A", "B", "B", "C"]
const decompressObj = obj =>
  Object.keys(obj).reduce((acc, item) => {
    for (i = 0; i < obj[item]; i++) {
      acc.push(item)
    }
    return acc
  }, [])

// Does what is says :)
const getRandomItemFromArray = arr =>
  arr[Math.floor(Math.random() * arr.length)]

// Consumes array of all original headlines and the probability table
// Returns the generated headline as a String
const generateTitle = (titles, probabilities, title = []) => {
  // Pick the first word of the generated title
  if (title.length < 1) {
    const candidates = decompressObj(probabilities[START_OF_TITLE])
    const startWord = getRandomItemFromArray(candidates)

    return generateTitle(titles, probabilities, [startWord])
  }

  const lastWord = title[title.length - 1]
  const candidates = decompressObj(probabilities[lastWord])
  const nextWord = getRandomItemFromArray(candidates)

  // Stitch the array to string
  const headline = finishHeadline(title)

  // If the previous word was the last one, finish the job
  if (nextWord === END_OF_TITLE) {
    // Must not be longer than 140 characters (yeah, Twitter supports 280)
    if (headline.length < 70 || headline.length > 140)
      return generateTitle(titles, probabilities, [])

    // Must not be same as the original
    if (titles.includes(headline))
      return generateTitle(titles, probabilities, [])

    return headline
  }

  // Keep generating until we reach the last word
  return generateTitle(titles, probabilities, [...title, nextWord])
}

// TODO: Remove unbalanced quotation marks
const finishHeadline = headline => headline.join(' ')

getFeedItems()
  .then(articles => {
    const titles = getArticleTitles(articles)
    const table = generateProbabilityTable(titles)

    setInterval(() => {
      const title = generateTitle(titles, table)
      console.clear()
      console.log('\n  ' + title)
    }, 4000)
  })
  .catch(console.error)
