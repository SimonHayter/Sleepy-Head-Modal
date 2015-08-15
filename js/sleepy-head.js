var idleTime = 0;

$(document).ready(function () {
    var idleInterval = setInterval(timerIncrement, 10000);
    $(this).mousemove(function (e) {
        idleTime = 0;
    });
    $(this).keypress(function (e) {
        idleTime = 0;
    });
    $(".sleepy-close, .sleepy-overlay, .sleepy-wake-up").click(function () {
        $(".sleepy-overlay").hide();
        idleTime = 0;
    });
    $('.sleepy-modal').click(function (event) {
        event.stopPropagation();
    });
});

function timerIncrement() {
    idleTime = idleTime + 1;
    if (idleTime > 1) {
        $('.sleepy-overlay').fadeIn('slow');
        idleTime = 0;
    }
}