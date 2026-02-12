import Globe from 'globe.gl'
import './styles.css'

//import * as THREE from 'three'

const globeContainer = document.getElementById('globe');

// earth-blue-marble (OR earth-dark, earth-day, earth-night etc)
const globe = Globe()(globeContainer)
  .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
  .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
  .backgroundColor('rgba(0,0,0,0)')

globe.controls().autoRotate = true;
globe.controls().autoRotateSpeed = 0.6;
globe.camera().position.z = 300;

document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("togglePlayer");
    const player = document.getElementById("musicPlayer");

    console.log(button, player); // debug check

    button.addEventListener("click", () => {
        player.classList.toggle("show");
    });
});