import trackRepo from '../database/trackRepo.js'

const fetchTopTracks = async (source, date, country) => {
  try {
  // get raw data from the database 
  const rawData = await trackRepo(source, date, country)

  // change supabase format to json 
    const tracks = rawData.map(track => ({
      // each iteration is an element in array
      rank: track.rank,
      title: track.track_name,
      artist: track.artist_name
    }))
  return {
    topSongs: rawData
  };
  } catch (error) {
    throw new Error(`Failed to fetch top tracks: ${error.message}`);
  }
}

export default fetchTopTracks