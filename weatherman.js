// Cartoon sponge weatherman who pops up from the bottom of the screen with the forecast.
// Tap him to hide him or bring him back.
const Weatherman = (() => {
  const el = document.getElementById("weatherman");
  const bubble = document.getElementById("weatherman-bubble");
  let hideTimer = null;
  let message = "";
  let alertNote = "";

  const isUp = () => el.classList.contains("up");

  function updateText() {
    bubble.textContent = alertNote ? `${message} ${alertNote}` : message;
  }

  function show() {
    updateText();
    el.classList.add("up");
    clearTimeout(hideTimer);
    // Duck back down after a while, leaving his eyes peeking out
    hideTimer = setTimeout(() => el.classList.remove("up"), 15000);
  }

  function hide() {
    clearTimeout(hideTimer);
    el.classList.remove("up");
  }

  el.addEventListener("click", () => (isUp() ? hide() : show()));

  return {
    report(text) {
      message = text;
      show();
    },
    alert(text) {
      alertNote = text;
      if (!text) return;
      if (isUp()) updateText();
      else show();
    },
  };
})();

function weathermanLine(name, current, daily, label, bg) {
  const temp = Math.round(current.temperature_2m);
  const hi = Math.round(daily.temperature_2m_max[0]);
  const lo = Math.round(daily.temperature_2m_min[0]);
  const lines = [`I'm ready! It's ${temp}° and ${label.toLowerCase()} in ${name}, with a high of ${hi}° and a low of ${lo}°.`];

  if (bg.code >= 95) lines.push("Storms are brewing, so stay inside and keep your spatula close!");
  else if (bg.code === 73) lines.push(bg.expected ? "Snow's on the way, so bundle up!" : "It's snowing! Bundle up, buddy!");
  else if (bg.code === 63) lines.push(bg.expected ? "Rain's on the way, so grab an umbrella!" : "It's wetter than Bikini Bottom out there. Grab an umbrella!");
  else if (temp >= 90) lines.push("It's hotter than a Krusty Krab grill! Stay cool and drink water.");
  else if (temp <= 50) lines.push("Brrr! Don't forget a jacket.");
  else if (daily.uv_index_max[0] >= 8) lines.push("Perfect jellyfishing weather, but don't forget sunscreen!");
  else lines.push("Perfect day for jellyfishing!");

  return lines.join(" ");
}
