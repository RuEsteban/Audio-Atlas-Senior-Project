import supabase from './supabaseClient.js'

const trackRepo = async (source, date, country) => {
    const { data, error } = await supabase
    .from('music_charts')
    .select('rank, artist_name, track_name, album_name, release_year, image_url, external_url')
    .eq('source', source)
    .eq('country', country)
    .eq('chart_date', date)
    .order('rank', { ascending: true })
    .limit(10);
    
    if (error) {
        throw error
    }

    return data;
}

export default trackRepo;
