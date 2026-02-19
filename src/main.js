import Globe from 'globe.gl';
import './styles.css';

const globeContainer = document.getElementById('globe');

const globe = Globe()(globeContainer)
  .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
  .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
  .backgroundColor('rgba(0,0,0,0)');

globe.controls().autoRotate = true;
globe.controls().autoRotateSpeed = 0.6;
globe.camera().position.z = 300;

document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("togglePlayer");
    const player = document.getElementById("musicPlayer");
    const optionContainer = document.getElementById("options");
    const topSongs = document.getElementById("topSongs");

    // Toggle music player, options, and top songs popup
    button.addEventListener("click", () => {
        player.classList.toggle("show");
        optionContainer.classList.toggle("hidden");
        topSongs.classList.toggle("hidden");
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

    // Song selector
    const songList = document.querySelector(".songList ul"); 
    let selectedSong = null; 

    if (songList) {
        songList.querySelectorAll("li").forEach(songItem => {
            songItem.addEventListener("click", () => {
                songList.querySelectorAll("li").forEach(item => {
                    item.classList.remove("selected-song");
                });

                songItem.classList.add("selected-song");

                const titleElem = songItem.querySelector(".song-info .title");
                const artistElem = songItem.querySelector(".song-info .artist");

                selectedSong = {
                    number: songItem.querySelector(".song-number").textContent,
                    title: titleElem ? titleElem.textContent : songItem.querySelector(".song-info").textContent,
                    artist: artistElem ? artistElem.textContent : "",
                    albumArt: songItem.querySelector("img").src
                };

                console.log("Selected song:", selectedSong);
            });
        });
    }
});
