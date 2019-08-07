if(!Array.prototype.from){
    Array.prototype.from = function(enumerable){
        var arr = [];
        for(var i = enumerable.length; i--; arr.unshift(enumerable[i]));
        return arr;
    };
}