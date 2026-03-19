import Globe from 'globe.gl'
import './styles.css'
import * as turf from '@turf/turf'
import { Country } from "./Country.js"
import { next } from '@vercel/edge';
//import { build } from 'vite';

import * as THREE from 'three'

const globeContainer = document.getElementById('globe');

// Country song data placeholder
let currCountry = null;
let topSongsArray =  null;
let currSong = 0;

//string to build fetch url
// example: https://audio-atlas-senior-project.onrender.com/api/lastfm/2026-03-01/US/top-tracks
let fetchURL = "https://audio-atlas-senior-project.onrender.com/api";

// database string
let selectedDatabase = "lastfm";

// week string, default current week  
let selectedWeek = getCurrentWeek();
console.log("Current week:", selectedWeek);

// selected country ISO
let selectedCountryISO = null;

const exitButton = document.getElementById("exitButton");


// search bar
let countryFeatures = [];
let fuse;
const input = document.getElementById("countryInput");
const suggestions = document.getElementById("suggestions");
const searchBar = document.getElementById("searchBar");

const countryName = document.getElementById("countryName");
const player = document.getElementById("musicPlayer");
const optionContainer = document.getElementById("options");
const topSongs = document.getElementById("topSongs");
const songContainer = document.getElementById("songContainer");
const toggleOptions = document.getElementById("toggleOptions");
let loadingElement;

// Globe creation
// earth-blue-marble (OR earth-dark, earth-day, earth-night etc)
const globe = Globe()(globeContainer)
  //.globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
  .globeImageUrl('/img/8k_earth_daymap.jpg')
  .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
  .backgroundColor('#000')
  .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
  .atmosphereColor('#00ffd5')
  .atmosphereAltitude(0.25)
  .showAtmosphere(true)
  .atmosphereAltitude(0.2);

globe.controls().autoRotate = true;
globe.controls().autoRotateSpeed = 0.3;
globe.controls().enableZoom = false;
globe.controls().enablePan = false;
globe.controls().enableRotate = false;

globe.width(window.innerWidth);
globe.height(window.innerHeight);

globe.polygonStrokeColor(() => 'rgba(0,0,0,0)');

let hover = null;
let highlightedCountry = null;
const disabledCountries = ["AQ", "RU", "BN", "CD", "CF", "CG", "CI", "CV", "ER", "FM", "GW", "IR", "KP", "LA", "LY", "MK", "NR", "PS", "SB", "SY", "SZ", "TO", "TV", "TZ", "VA", "XK"];

function selectCountry(d) {
  const audio = document.getElementById("audioPlayer");
  audio.pause();
  audio.currentTime = 0;
  currSong = 0;

  document.getElementById("timelineBar").style.width = "0%";
  playButton.innerHTML = '<i class="fa-solid fa-play"></i>';

  // reset currsong index

  if (!selectedDatabase) {
    alert("Please select a database first.");
    return;
  }

  console.log("Name:",d.properties.name);
  console.log("ISO Alpha-2:", d.properties.iso_a2);

  if(d.properties.name == "France") {
    selectedCountryISO = "FR";
  } else if (d.properties.name == "Norway") {
    selectedCountryISO = "NO";
  } else if (d.properties.name == "Somaliland"){
    selectedCountryISO = "SO";
  } else if (d.properties.name == "Kosovo") {
    selectedCountryISO = "XK"; 
  } else {
    selectedCountryISO = d.properties.iso_a2;
  }

  const [lng, lat] = d.properties.centroid;
  globe.pointOfView({ lat, lng, altitude: 1 }, 1000);

  fetchTopSongs(selectedCountryISO);

  currCountry = new Country(d.properties.name, topSongsArray);

  if (countryName) {
    countryName.textContent = currCountry.name;
  }

  player.classList.add("show");
  songContainer.classList.add("show");
  searchBar.classList.add("move");
  exitButton.classList.add("show");
  globeContainer.classList.add("select");
  title.classList.remove("show");

  highlightedCountry = d.properties.iso_a2;
  globe.polygonCapColor(p => {
    if (disabledCountries.includes(p.properties.iso_a2)) {
      return 'rgba(128,128,128,0.6)';
    }
    if (p.properties.iso_a2 === highlightedCountry) {
      return'rgba(0,255,255,0.4)';
    }
    return 'rgba(0,0,0,0)';
  });
}

window.addEventListener('resize', () => {
  globe.width(window.innerWidth);
  globe.height(window.innerHeight);
});

// enter button
const enterButton = document.getElementById("enter");
const greeterContainer = document.getElementById("greeter");
const globeElement = document.getElementById("globe");
const title = document.getElementById("title");

enterButton.addEventListener("click", () => {
  console.log("enter");

  searchBar.classList.add("show");
  optionContainer.classList.add("show");
  greeterContainer.classList.add("hidden");
  globeElement.classList.add("enter");
  toggleOptions.classList.add("show");
  
  globe.controls().autoRotate = false;
  globe.controls().enableZoom = true;
  globe.controls().enablePan = true;
  globe.controls().enableRotate = true;

  setTimeout(() => {
    title.offsetWidth; 
    title.classList.add("show");
  }, 500);

  fetch('/custom.geo.json')
  .then(res => res.json())
  .then(data => {
    // centering upon zoom according to country data
    const countries = data.features.map(feature => {
      const centroid = turf.centroid(feature);
      feature.properties.centroid = centroid.geometry.coordinates;
      return feature;
    });

    countryFeatures = countries;

    const countryNames = countries.map(c => c.properties.name);

    fuse = new Fuse(countryNames, {
      threshold: 0.3
    });

    globe
      .polygonsData(countries)
      .polygonSideColor(() => 'rgba(0,0,0,0)')
      .polygonStrokeColor(() => '#00eeff')
      .polygonCapColor(d => {
        if (disabledCountries.includes(d.properties.iso_a2)) {
          return 'rgba(128,128,128,0.6)';
        }
        if (d.properties.iso_a2 === highlightedCountry) {
          return 'rgba(255,204,128,0.7)';
        }
        return 'rgba(0,0,0,0)';
      })
      .onPolygonHover(p => {
        hover = p;
        globe.polygonCapColor(d => {
          if (disabledCountries.includes(d.properties.iso_a2)){
            return 'rgba(128,128,128,0.6)';
          }
          if (d.properties.iso_a2 === highlightedCountry) {
            return 'rgba(0,255,255,0.4)';
          }
          return d === hover ? 'rgba(0,255,255,0.4)' : 'rgba(0,0,0,0)';
      });
    })
    .onPolygonClick(d => {
      if (disabledCountries.includes(d.properties.iso_a2)) {
        const name = d.properties.name;
        alert(`No music available for ${d.properties.name}`);

        return;
      }

      console.log("countryName: " + d.properties.name);
      selectCountry(d);
    });
  });
});

toggleOptions.addEventListener("click", () => {
  if (optionContainer.classList.contains("show") || !toggleOptions.classList.contains("hide")) {
    toggleOptions.classList.remove("show");
    toggleOptions.classList.add("hide");
    optionContainer.classList.remove("show");
  } else {
    toggleOptions.classList.add("show");
    toggleOptions.classList.remove("hide");
    optionContainer.classList.add("show");
  }
});


document.addEventListener("DOMContentLoaded", () => {
    // exit button for music player
    exitButton.addEventListener("click", () => {
        audio.pause();
        player.classList.remove("show");
        player.classList.remove("play");
        songContainer.classList.remove("show");
        searchBar.classList.remove("move");
        exitButton.classList.remove("show");
        globeContainer.classList.remove("select");
        title.classList.add("show");

        highlightedCountry = null;
    });

    loadingElement = document.getElementById("loading");

    // Database selector
    const radios = document.querySelectorAll('input[name="database"]');
    radios.forEach(radio => {
        radio.addEventListener('change', () => {
            selectedDatabase = radio.value;
            console.log("Selected database:", selectedDatabase);
            if (selectedCountryISO) {
              fetchTopSongs(selectedCountryISO);
            }

            if(selectedDatabase === "lastfm") {
              options.classList.add("lastfm");
              options.classList.remove("spotify");
              options.classList.remove("agg"); 
            }
            else if(selectedDatabase === "spotify") {
              options.classList.add("spotify");
              options.classList.remove("lastfm");
              options.classList.remove("agg");
            }
            else {
              options.classList.remove("spotify");
              options.classList.remove("lastfm");
              options.classList.add("agg");
            }

        });
    });

    // Week selector (custom dropdown)
    const dropdown = document.querySelector(".custom-dropdown");
    if (dropdown) {
        const selected = dropdown.querySelector(".selected");
        const optionsList = dropdown.querySelector(".options");

        // Clear old options and generate Thursdays
        optionsList.innerHTML = "";
        generateThursdayOptions(optionsList);

        // Set displayed selected week
        const [year, month, day] = selectedWeek.split("-").map(Number);
        selected.textContent = formatDateForDisplay(new Date(year, month - 1, day));


        selected.addEventListener("click", e => {
            e.stopPropagation();
            if(!selected.classList.contains("open")){
              selected.classList.add("open");
              optionsList.classList.add("show");
            } else {
              selected.classList.remove("open");
              optionsList.classList.remove("show");
            }
        });

        optionsList.querySelectorAll("li").forEach(option => {
            option.addEventListener("click", () => {
                selected.textContent = option.textContent;
                selectedWeek = option.getAttribute("data-value");
                console.log("Selected week:", selectedWeek);
                if (selectedCountryISO) {
                  fetchTopSongs(selectedCountryISO);
                } 
                selected.classList.remove("open");
                optionsList.classList.remove("show");
            });
        });

        document.addEventListener("click", e => {
            if (!dropdown.contains(e.target)) {
                selected.classList.remove("open");
                optionsList.classList.remove("show");
            }
        });
    }
    // connect to audio
    const audio = document.getElementById("audioPlayer");
    const playButton = document.getElementById("playButton");
    const backButton = document.getElementById("backButton");
    const nextButton = document.getElementById("nextButton");
    const volumeBar = document.getElementById("volumeBar");
    audio.volume = 0.1;
    volumeBar.value = 0.1;

    const timelineBar = document.getElementById("timelineBar");

    const currentTime = document.getElementById("currentTime");
    const fullTime = document.getElementById("fullTime");
    const barContainer = document.getElementById("barContainer");

    volumeBar.addEventListener("input", () => {
      audio.volume = volumeBar.value;
    });

    // play or pause button
    playButton.addEventListener("click", () => {
        if (audio.paused) {
            audio.play();
            player.classList.add("play");
            playButton.innerHTML = '<i class="fa-solid fa-pause"></i>';
        }
        else {
            audio.pause();
            player.classList.remove("play");
            playButton.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
    });

    nextButton.addEventListener("click", nextSong);
    backButton.addEventListener("click", prevSong);

    // update progress bar (out of 30 seconds)
    audio.addEventListener("timeupdate", () => {
      if (!audio.duration) {
        return;
      }

      const percent = (audio.currentTime / audio.duration) * 100;
      timelineBar.style.width = percent + "%";
      currentTime.textContent = convertToMins(audio.currentTime);

      const timeLeft = audio.duration - audio.currentTime;
      fullTime.textContent = "-" + convertToMins(timeLeft);
    });

    audio.addEventListener("loadedmetadata", () => {
      fullTime.textContent = convertToMins(audio.duration);
    });

    audio.addEventListener("ended", () => {
      audio.currentTime = 0;
      playButton.innerHTML = '<i class="fa-solid fa-play"></i>';
      timelineBar.style.width = "0%";
      currentTime.textContent = "0:00";
      player.classList.remove("play");
    });

    barContainer.addEventListener("click", (e) => {
      const rect = barContainer.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;

      audio.currentTime = percent * audio.duration;
    });
});

const usedAudios = new Map();

async function audioPreview(title, artist) {
  try {
      // http get request sent, retrieves song data
      const search = encodeURIComponent(`${title} ${artist}`);
      const audio = document.getElementById("audioPlayer");
      let country = "us";

      if (usedAudios.has(search)) {
        audio.src = usedAudios.get(search);
        audio.currentTime = 0;
        audio.play();
        player.classList.add("play");
        return;
      }

      const res = await fetch(
      `https://itunes.apple.com/search?term=${search}&entity=song&limit=1&country=${country}`
      );

      const data = await res.json();

      if (!data.results.length || !data.results[0].previewUrl) {
          console.log("No preview");
          return;
      }

      // extract URL
      const previewUrl = data.results[0].previewUrl;
      usedAudios.set(search, previewUrl);
      audio.src = previewUrl;
      audio.currentTime = 0;
      audio.play();

      playButton.innerHTML = '<i class="fa-solid fa-pause"></i>';

      } catch (error) {
          console.error("Fetch error:", error);
      }
}

function getCurrentWeek() {
    const start = new Date(2026, 1, 26);
    const today = new Date();

    const diffInDays = Math.floor((today - start) / (1000 * 60 * 60 * 24));
    const weeksPassed = Math.floor(diffInDays / 7);

    const currentWeek = new Date(start);
    currentWeek.setDate(start.getDate() + weeksPassed * 7);

    return formatDateForValue(currentWeek);
}


function generateThursdayOptions(optionsList, numWeeks = 52) {
    optionsList.innerHTML = "";

    const start = new Date(2026, 1, 26);

    for (let i = 0; i < numWeeks; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i * 7);

        const value = formatDateForValue(d);
        const display = formatDateForDisplay(d);

        const li = document.createElement("li");
        li.setAttribute("data-value", value);
        li.textContent = display;

        optionsList.appendChild(li);
    }
}

function formatDateForValue(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDateForDisplay(date) {
    const options = { year: 'numeric', month: 'short', day: 'numeric'};
    return date.toLocaleDateString(undefined, options);
}



function convertToMins(time) {
  const mins = Math.floor(time / 60);
  let secs = Math.floor(time - mins * 60);

  if (secs < 10) {
    secs = secs.toString().padStart(2, "0");
  }

  return `${mins}:${secs}`;
}

async function fetchTopSongs(countryISO) {
  displayLoading();

  console.log("Current Week: " + selectedWeek);
  let buildURL = `${fetchURL}/${selectedDatabase}/${selectedWeek}/${countryISO}/top-tracks`;
  console.log("Fetch URL:", buildURL);

  

  fetch(buildURL)
    .then(response => response.json())
    .then(data => {
      console.log("API response:", data);

      topSongsArray = data.topSongs;

      populateSongList(topSongsArray);
      currSong = 0;
      playSong(0);
      hideLoading();
    })
    .catch(error => {
      console.error("Fetch error:", error);
      hideLoading();
    });
}

function truncateText(text) {
  if (!text) return "";
  return text.length > 30 ? text.slice(0, 30) + "…" : text;
}

function playSong(index) {
  if (!topSongsArray) {
    return;
  }

  const song = topSongsArray[index];

  currSong = index;

  document.getElementById("songName").innerHTML =
  `<a href="${song.external_url || "#"}" target="_blank">${truncateText(song.track_name || "Unknown")}</a>`;
  document.getElementById("artistName").textContent = truncateText(song.artist_name || "Unknown");
  document.getElementById("albumName").textContent = 
  `${truncateText(song.album_name || "Unknown")} (${truncateText(song.release_year || "Unknown")})`;

  document.querySelectorAll("#songList li").forEach(item =>
    item.classList.remove("selected-song")
  );

  const items = document.querySelectorAll("#songList li");
  if (items[index]) {
    items[index].classList.add("selected-song");
  }

  audioPreview(song.track_name, song.artist_name);

  playButton.innerHTML = '<i class="fa-solid fa-pause"></i>';

  player.classList.add("play");
}

function nextSong() {
  if (!topSongsArray) {
    return;
  }

  currSong = (currSong + 1)  % topSongsArray.length;
  playSong(currSong);
}

function prevSong() {
  if (!topSongsArray) {
    return;
  }

  currSong = (currSong - 1 + topSongsArray.length)  % topSongsArray.length;
  playSong(currSong);
}

function populateSongList(songs) {
  const songList = document.querySelector("#songList ul");
  songList.innerHTML = ""; // clear existing songs

  if (!songs || songs.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No songs found for this country and week within this database.";
    songList.appendChild(li);
    return;
  }

  songs.forEach((song, index) => {
    const li = document.createElement("li");

    let ext_url = song.external_url || "#";
    let img_url = song.image_url || '/img/default-album.png';
    let rank = song.rank || "-";
    let track_name = song.track_name || "Unknown";
    let artist_name = song.artist_name || "Unknown";
    let album_name = song.album_name || "Unknown";
    let release_year = song.release_year || "Unknown";

    li.innerHTML = `
      <div class="song-number">${truncateText(rank)}</div>
      <a href="${ext_url}" target="_blank" class="album-link">
        <img src="${img_url}" alt="Album" />
      </a>
      <div class="song-info">
        <span class="title">${truncateText(track_name)}</span>
        <span class="artist">${truncateText(artist_name)}</span>
      </div>
    `;

    const link = li.querySelector(".album-link");
      link.addEventListener("click", (e) => {
      e.stopPropagation();
    });


    if (index === 0) {
      li.classList.add("selected-song");

      document.getElementById("songName").innerHTML =
        `<a href="${song.external_url || "#"}" target="_blank">${truncateText(song.track_name || "Unknown")}</a>`;
      document.getElementById("artistName").textContent = truncateText(song.artist_name);
      document.getElementById("albumName").textContent =
        `${truncateText(song.album_name)} (${truncateText(song.release_year)})`;
    }

    li.addEventListener("click", () => {
      document.querySelectorAll("#songList li").forEach(item =>
        item.classList.remove("selected-song")
      );

      currSong = index;

      li.classList.add("selected-song");

      document.getElementById("songName").innerHTML =
        `<a href="${song.external_url || "#"}" target="_blank">${truncateText(song.track_name || "Unknown")}</a>`;
      document.getElementById("artistName").textContent = truncateText(artist_name);
      document.getElementById("albumName").textContent =
        `${truncateText(album_name)} (${truncateText(release_year)})`;

      audioPreview(song.track_name, song.artist_name);

      console.log("Selected song:", song);
    });

    songList.appendChild(li);
  });
}

function displayLoading() {
  loadingElement.classList.add("display");
  const songList = document.getElementById("songList");
  songList.classList.add("hidden");
  console.log("Loading...");
}

function hideLoading() {
  loadingElement.classList.remove("display");
  const songList = document.getElementById("songList");
  songList.classList.remove("hidden");
  console.log("Loading complete.");
}

input.addEventListener("input", () => {
  if (!fuse) return;

  const value = input.value.trim();
  suggestions.innerHTML = "";

  if (!value) return;

  const results = fuse.search(value);

  results.slice(0, 5).forEach(result => {
    const li = document.createElement("li");
    li.textContent = result.item;

    li.addEventListener("click", () => {
      input.value = result.item;
      suggestions.innerHTML = "";

      const country = countryFeatures.find(
        c => c.properties.name === result.item
      );

      if (country && disabledCountries.includes(country.properties.iso_a2)) {
        return;
      }

      if (country) {
        selectCountry(country);
      }
    });

    suggestions.appendChild(li);
  });
});