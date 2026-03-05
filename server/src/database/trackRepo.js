import supabase from './supabaseClient.js'

const trackRepo = async (date, country) => {
    const { data, error } = await supabase
    .from('music_charts')
    .select('rank, track_name, artist_name')
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
