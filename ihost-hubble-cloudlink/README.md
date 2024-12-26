# HomeAssistant: Hubble Cloudlink Data Logger

<center>
<img src="./public/logo.png" style="height: 256px; " />
<h2>Hubble Cloudlink Data Logger</h2>
</center>

This add-on for iHost connects the data from your Hubble Cloudlink (Riot Systems) dashboard.

Data is fetched from the cloud, so this requires internet access.


## Setup

1. Go to Docker > Volume > Create volume
    1. Enter name `cloudlinkVolume` and press confirm
2. Go to Docker > Add-on List > Add > Add Add-on
    1. Search and select jjv360/ihost-hubble-cloudlink
    2. Select jjv360/ihost-hubble-cloudlink and click Install, then when it completes click Run
    3. Set network: `host`
    4. Set volume: `cloudlinkVolume` `/app/userdata`
    5. Press Run

After that, you can log in to the web interface by going to More Info and clicking the open icon next to the Port setting.


## Development

Run `npm install` to install dependencies, then `npm start` to start the server locally. Requires an iHost at http://ihost.local.

Run `npm docker:publish` to publish to the Docker registry.