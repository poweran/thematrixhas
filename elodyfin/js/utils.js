// --- SIMPLE TWEEN LIBRARY ---
export const TWEEN = {
    tweens: [],
    update(time) {
        this.tweens = this.tweens.filter(t => t.update(time));
    },
    Tween: function (obj) {
        this.obj = obj;
        this.target = {};
        this.startTime = 0;
        this.duration = 0;
        this.to = function (target, duration) {
            this.target = target;
            this.duration = duration;
            this.startVals = { r: obj.r, g: obj.g, b: obj.b };
            this.startTime = performance.now();
            TWEEN.tweens.push(this);
            return this;
        }
        this.start = function () { return this; }
        this.update = function (time) {
            const elapsed = time - this.startTime;
            if (elapsed >= this.duration) {
                this.obj.r = this.target.r;
                this.obj.g = this.target.g;
                this.obj.b = this.target.b;
                return false;
            }
            const pct = elapsed / this.duration;
            this.obj.r = this.startVals.r + (this.target.r - this.startVals.r) * pct;
            this.obj.g = this.startVals.g + (this.target.g - this.startVals.g) * pct;
            this.obj.b = this.startVals.b + (this.target.b - this.startVals.b) * pct;
            return true;
        }
    }
};
