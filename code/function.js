var exec = require('child_process').exec;


var cmd = 'ffmpeg -protocol_whitelist file,http,https,tcp,tls,crypto -i test.m3u8 -bsf:a aac_adtstoasc -vcodec copy -c copy -crf 50 file.mp4';

exec(cmd, function(err, stdout, stderr) {
    if (err) console.log('err:\n' + err);
    if (stderr) console.log('stderr:\n' + stderr);
    console.log('stdout:\n' + stdout);
});