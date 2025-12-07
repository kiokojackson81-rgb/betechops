"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
describe("computeUploadProgress", () => {
    test("zero uploads", () => {
        const res = (0, utils_1.computeUploadProgress)({ newUploaded: 0, copiesUploaded: 0, productsEdited: 0 }, 50);
        expect(res.uploadsToday).toBe(0);
        expect(res.pct).toBe(0);
    });
    test("half of target", () => {
        const res = (0, utils_1.computeUploadProgress)({ newUploaded: 25, copiesUploaded: 0, productsEdited: 0 }, 50);
        expect(res.uploadsToday).toBe(25);
        expect(res.pct).toBe(50);
    });
    test("exactly 100%", () => {
        const res = (0, utils_1.computeUploadProgress)({ newUploaded: 50, copiesUploaded: 0, productsEdited: 0 }, 50);
        expect(res.uploadsToday).toBe(50);
        expect(res.pct).toBe(100);
    });
    test(">100%", () => {
        const res = (0, utils_1.computeUploadProgress)({ newUploaded: 60, copiesUploaded: 10, productsEdited: 0 }, 50);
        expect(res.uploadsToday).toBe(70);
        expect(res.pct).toBe(140);
    });
    test("string inputs are parsed", () => {
        const res = (0, utils_1.computeUploadProgress)({ newUploaded: "10", copiesUploaded: "5", productsEdited: "2" }, 50);
        expect(res.uploadsToday).toBe(17);
        expect(res.pct).toBe(Math.round((17 / 50) * 100));
    });
});
