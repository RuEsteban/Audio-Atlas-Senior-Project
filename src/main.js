import Globe from 'globe.gl'
import './styles.css'
import * as turf from '@turf/turf'

//import * as THREE from 'three'

const globeContainer = document.getElementById('globe');

// Globe creation
// earth-blue-marble (OR earth-dark, earth-day, earth-night etc)
const globe = Globe()(globeContainer)
  //.globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
  .globeImageUrl('/src/8k_earth_daymap.jpg')
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

fetch('/src/custom.geo.json')
  .then(res => res.json())
  .then(data => {
    // centering upon zoom according to country data
    const countries = data.features.map(feature => {
      const centroid = turf.centroid(feature);
      feature.properties.centroid = centroid.geometry.coordinates;
      return feature;
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

      .onPolygonClick(d => {
        console.log(d.properties);
        
        const [lng, lat] = d.properties.centroid;
        globe.pointOfView(
          { lat, lng, altitude: 1 }, // zoom altitude
          1000 // how fast
        );
      });
  });

document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("togglePlayer");
    const player = document.getElementById("musicPlayer");

    console.log(button, player); // debug check

    button.addEventListener("click", () => {
        player.classList.toggle("show");
    });
});