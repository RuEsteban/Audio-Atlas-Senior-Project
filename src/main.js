import Globe from 'globe.gl'
import './styles.css'
import * as turf from '@turf/turf'
import { Country } from "./Country.js"

//import * as THREE from 'three'

const globeContainer = document.getElementById('globe');

// Country song data placeholder
let currCountry = null;
let topSongsArray =  null;


// search bar
let countryFeatures = [];
let fuse;
const input = document.getElementById("countryInput");
const suggestions = document.getElementById("suggestions");

const countryName = document.getElementById("countryName");
const player = document.getElementById("musicPlayer");
const optionContainer = document.getElementById("options");
const topSongs = document.getElementById("topSongs");

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

//globe.controls().autoRotate = true;
globe.controls().autoRotateSpeed = 0.6;
globe.camera().position.z = 300;

let hover = null;
let select = null;

function selectCountry(d) {
  console.log(d.properties.name);

  const [lng, lat] = d.properties.centroid;
  globe.pointOfView(
    { lat, lng, altitude: 1 },
    1000
  );

  // Get song data from database  
  fetch('https://audio-atlas-senior-project.onrender.com/api/test')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('API response:', data);
      topSongsArray = data.topSongs;
      populateSongList(topSongsArray);
    })
    .catch(error => {
      console.error('Fetch error:', error);
    });

  currCountry = new Country(d.properties.name, topSongsArray);

  if (countryName) {
    countryName.textContent = currCountry.name;
    fitHeaderText(countryName);
  }

  player.classList.add("show");
  optionContainer.classList.add("hidden");
  topSongs.classList.add("show");
}

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
      //.polygonAltitude(0.01)
      //.polygonAltitude(d => d === hover ? 0.03 : 0.01)
      .polygonStrokeColor(() => '#00eaff')
      .polygonCapColor(() => 'rgba(0,0,0,0)')
      .onPolygonHover(p => {
        hover = p;
        globe.polygonCapColor(poly =>
          poly === hover ? 'rgba(0,255,255,0.4)' : 'rgba(0,0,0,0)'
        );
      })

      .onPolygonClick(d => selectCountry(d));
  });

document.addEventListener("DOMContentLoaded", () => {
    // exit button for music player
    const exitButton = document.getElementById("closeTopSongs");
    exitButton.addEventListener("click", () => {
        player.classList.remove("show");
        optionContainer.classList.remove("hidden");
        topSongs.classList.remove("show");
    });

    // Database selector
    const radios = document.querySelectorAll('input[name="database"]');
    let selectedDatabase = null;

    radios.forEach(radio => {
        radio.addEventListener('change', () => {
            selectedDatabase = radio.value;
            console.log("Selected database:", selectedDatabase);
        });
    });

    // Week selector (custom dropdown)
    const dropdown = document.querySelector(".custom-dropdown");
    if (dropdown) {
        const selected = dropdown.querySelector(".selected");
        const optionsList = dropdown.querySelector(".options");
        let selectedWeek = selected.textContent;

        selected.addEventListener("click", e => {
            e.stopPropagation();
            optionsList.style.display = optionsList.style.display === "block" ? "none" : "block";
        });

        optionsList.querySelectorAll("li").forEach(option => {
            option.addEventListener("click", () => {
                selected.textContent = option.textContent;
                optionsList.style.display = "none";
                selectedWeek = option.getAttribute("data-value");
                console.log("Selected week:", selectedWeek);
            });
        });

        document.addEventListener("click", e => {
            if (!dropdown.contains(e.target)) {
                optionsList.style.display = "none";
            }
        });
    }
});

function populateSongList(songs) {
  const songList = document.querySelector("#songList ul");
  songList.innerHTML = ""; // clear existing songs

  songs.forEach(song => {
    const li = document.createElement("li");

    li.innerHTML = `
      <div class="song-number">${song.rank}</div>
      <img src="/img/default-album.png" alt="Album" />
      <div class="song-info">
        <span class="title">${song.title}</span>
        <span class="artist">${song.artist}</span>
        <span class="album">${song.album}</span>
        <span class="year">${song.year}</span>
      </div>
    `;

    li.addEventListener("click", () => {
      document.querySelectorAll("#songList li").forEach(item =>
        item.classList.remove("selected-song")
      );
      li.classList.add("selected-song");

      document.getElementById("songName").textContent = song.title;
      document.getElementById("artistName").textContent = song.artist;

      console.log("Selected song:", song);
    });

    songList.appendChild(li);
  });
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

      if (country) {
        selectCountry(country);
      }
    });

    suggestions.appendChild(li);
  });
});