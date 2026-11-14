#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
//
// GENERATED FILE. Do not edit: change the sources and run `pnpm build:skill`.
// The Voxwright skill CLI, bundled from packages/mcbuilder/src/node/skill/main.ts
// (packages/mcbuilder, packages/core and the software renderer of packages/render).
// It needs Node 22.18 or later and nothing else.
//
// Third-party code bundled in this file, with its licence:
//
// fflate 0.8.3 (MIT)
//
//   MIT License
//
//   Copyright (c) 2026 Arjun Barrett
//
//   Permission is hereby granted, free of charge, to any person obtaining a copy
//   of this software and associated documentation files (the "Software"), to deal
//   in the Software without restriction, including without limitation the rights
//   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//   copies of the Software, and to permit persons to whom the Software is
//   furnished to do so, subject to the following conditions:
//
//   The above copyright notice and this permission notice shall be included in all
//   copies or substantial portions of the Software.
//
//   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
//   SOFTWARE.
//
// pngjs 7.0.0 (MIT)
//
//   pngjs original work Copyright (c) 2015 Luke Page & Original Contributors
//   pngjs derived work Copyright (c) 2012 Kuba Niegowski
//
//   Permission is hereby granted, free of charge, to any person obtaining a copy
//   of this software and associated documentation files (the "Software"), to deal
//   in the Software without restriction, including without limitation the rights
//   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//   copies of the Software, and to permit persons to whom the Software is
//   furnished to do so, subject to the following conditions:
//
//   The above copyright notice and this permission notice shall be included in
//   all copies or substantial portions of the Software.
//
//   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//   THE SOFTWARE.
//
// smol-toml 1.9.1 (BSD-3-Clause)
//
//   Copyright (c) Squirrel Chat et al., All rights reserved.
//
//   Redistribution and use in source and binary forms, with or without
//   modification, are permitted provided that the following conditions are met:
//
//   1. Redistributions of source code must retain the above copyright notice, this
//      list of conditions and the following disclaimer.
//   2. Redistributions in binary form must reproduce the above copyright notice,
//      this list of conditions and the following disclaimer in the
//      documentation and/or other materials provided with the distribution.
//   3. Neither the name of the copyright holder nor the names of its contributors
//      may be used to endorse or promote products derived from this software without
//      specific prior written permission.
//
//   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
//   ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
//   WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
//   DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
//   FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
//   DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
//   SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
//   CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
//   OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
//   OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

import { createRequire as __createRequire } from "node:module";
const require = __createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x2) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x2, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x2)(function(x2) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x2 + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/chunkstream.js
var require_chunkstream = __commonJS({
  "node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/chunkstream.js"(exports, module) {
    "use strict";
    var util = __require("util");
    var Stream = __require("stream");
    var ChunkStream = module.exports = function() {
      Stream.call(this);
      this._buffers = [];
      this._buffered = 0;
      this._reads = [];
      this._paused = false;
      this._encoding = "utf8";
      this.writable = true;
    };
    util.inherits(ChunkStream, Stream);
    ChunkStream.prototype.read = function(length, callback) {
      this._reads.push({
        length: Math.abs(length),
        // if length < 0 then at most this length
        allowLess: length < 0,
        func: callback
      });
      process.nextTick(
        function() {
          this._process();
          if (this._paused && this._reads && this._reads.length > 0) {
            this._paused = false;
            this.emit("drain");
          }
        }.bind(this)
      );
    };
    ChunkStream.prototype.write = function(data, encoding) {
      if (!this.writable) {
        this.emit("error", new Error("Stream not writable"));
        return false;
      }
      let dataBuffer;
      if (Buffer.isBuffer(data)) {
        dataBuffer = data;
      } else {
        dataBuffer = Buffer.from(data, encoding || this._encoding);
      }
      this._buffers.push(dataBuffer);
      this._buffered += dataBuffer.length;
      this._process();
      if (this._reads && this._reads.length === 0) {
        this._paused = true;
      }
      return this.writable && !this._paused;
    };
    ChunkStream.prototype.end = function(data, encoding) {
      if (data) {
        this.write(data, encoding);
      }
      this.writable = false;
      if (!this._buffers) {
        return;
      }
      if (this._buffers.length === 0) {
        this._end();
      } else {
        this._buffers.push(null);
        this._process();
      }
    };
    ChunkStream.prototype.destroySoon = ChunkStream.prototype.end;
    ChunkStream.prototype._end = function() {
      if (this._reads.length > 0) {
        this.emit("error", new Error("Unexpected end of input"));
      }
      this.destroy();
    };
    ChunkStream.prototype.destroy = function() {
      if (!this._buffers) {
        return;
      }
      this.writable = false;
      this._reads = null;
      this._buffers = null;
      this.emit("close");
    };
    ChunkStream.prototype._processReadAllowingLess = function(read2) {
      this._reads.shift();
      let smallerBuf = this._buffers[0];
      if (smallerBuf.length > read2.length) {
        this._buffered -= read2.length;
        this._buffers[0] = smallerBuf.slice(read2.length);
        read2.func.call(this, smallerBuf.slice(0, read2.length));
      } else {
        this._buffered -= smallerBuf.length;
        this._buffers.shift();
        read2.func.call(this, smallerBuf);
      }
    };
    ChunkStream.prototype._processRead = function(read2) {
      this._reads.shift();
      let pos = 0;
      let count = 0;
      let data = Buffer.alloc(read2.length);
      while (pos < read2.length) {
        let buf = this._buffers[count++];
        let len = Math.min(buf.length, read2.length - pos);
        buf.copy(data, pos, 0, len);
        pos += len;
        if (len !== buf.length) {
          this._buffers[--count] = buf.slice(len);
        }
      }
      if (count > 0) {
        this._buffers.splice(0, count);
      }
      this._buffered -= read2.length;
      read2.func.call(this, data);
    };
    ChunkStream.prototype._process = function() {
      try {
        while (this._buffered > 0 && this._reads && this._reads.length > 0) {
          let read2 = this._reads[0];
          if (read2.allowLess) {
            this._processReadAllowingLess(read2);
          } else if (this._buffered >= read2.length) {
            this._processRead(read2);
          } else {
            break;
          }
        }
        if (this._buffers && !this.writable) {
          this._end();
        }
      } catch (ex) {
        this.emit("error", ex);
      }
    };
  }
});

// node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/interlace.js
var require_interlace = __commonJS({
  "node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/interlace.js"(exports) {
    "use strict";
    var imagePasses = [
      {
        // pass 1 - 1px
        x: [0],
        y: [0]
      },
      {
        // pass 2 - 1px
        x: [4],
        y: [0]
      },
      {
        // pass 3 - 2px
        x: [0, 4],
        y: [4]
      },
      {
        // pass 4 - 4px
        x: [2, 6],
        y: [0, 4]
      },
      {
        // pass 5 - 8px
        x: [0, 2, 4, 6],
        y: [2, 6]
      },
      {
        // pass 6 - 16px
        x: [1, 3, 5, 7],
        y: [0, 2, 4, 6]
      },
      {
        // pass 7 - 32px
        x: [0, 1, 2, 3, 4, 5, 6, 7],
        y: [1, 3, 5, 7]
      }
    ];
    exports.getImagePasses = function(width, height) {
      let images = [];
      let xLeftOver = width % 8;
      let yLeftOver = height % 8;
      let xRepeats = (width - xLeftOver) / 8;
      let yRepeats = (height - yLeftOver) / 8;
      for (let i2 = 0; i2 < imagePasses.length; i2++) {
        let pass = imagePasses[i2];
        let passWidth = xRepeats * pass.x.length;
        let passHeight = yRepeats * pass.y.length;
        for (let j = 0; j < pass.x.length; j++) {
          if (pass.x[j] < xLeftOver) {
            passWidth++;
          } else {
            break;
          }
        }
        for (let j = 0; j < pass.y.length; j++) {
          if (pass.y[j] < yLeftOver) {
            passHeight++;
          } else {
            break;
          }
        }
        if (passWidth > 0 && passHeight > 0) {
          images.push({ width: passWidth, height: passHeight, index: i2 });
        }
      }
      return images;
    };
    exports.getInterlaceIterator = function(width) {
      return function(x2, y, pass) {
        let outerXLeftOver = x2 % imagePasses[pass].x.length;
        let outerX = (x2 - outerXLeftOver) / imagePasses[pass].x.length * 8 + imagePasses[pass].x[outerXLeftOver];
        let outerYLeftOver = y % imagePasses[pass].y.length;
        let outerY = (y - outerYLeftOver) / imagePasses[pass].y.length * 8 + imagePasses[pass].y[outerYLeftOver];
        return outerX * 4 + outerY * width * 4;
      };
    };
  }
});

// node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/paeth-predictor.js
var require_paeth_predictor = __commonJS({
  "node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/paeth-predictor.js"(exports, module) {
    "use strict";
    module.exports = function paethPredictor(left, above, upLeft) {
      let paeth = left + above - upLeft;
      let pLeft = Math.abs(paeth - left);
      let pAbove = Math.abs(paeth - above);
      let pUpLeft = Math.abs(paeth - upLeft);
      if (pLeft <= pAbove && pLeft <= pUpLeft) {
        return left;
      }
      if (pAbove <= pUpLeft) {
        return above;
      }
      return upLeft;
    };
  }
});

// node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/filter-parse.js
var require_filter_parse = __commonJS({
  "node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/filter-parse.js"(exports, module) {
    "use strict";
    var interlaceUtils = require_interlace();
    var paethPredictor = require_paeth_predictor();
    function getByteWidth(width, bpp, depth) {
      let byteWidth = width * bpp;
      if (depth !== 8) {
        byteWidth = Math.ceil(byteWidth / (8 / depth));
      }
      return byteWidth;
    }
    var Filter = module.exports = function(bitmapInfo, dependencies) {
      let width = bitmapInfo.width;
      let height = bitmapInfo.height;
      let interlace = bitmapInfo.interlace;
      let bpp = bitmapInfo.bpp;
      let depth = bitmapInfo.depth;
      this.read = dependencies.read;
      this.write = dependencies.write;
      this.complete = dependencies.complete;
      this._imageIndex = 0;
      this._images = [];
      if (interlace) {
        let passes = interlaceUtils.getImagePasses(width, height);
        for (let i2 = 0; i2 < passes.length; i2++) {
          this._images.push({
            byteWidth: getByteWidth(passes[i2].width, bpp, depth),
            height: passes[i2].height,
            lineIndex: 0
          });
        }
      } else {
        this._images.push({
          byteWidth: getByteWidth(width, bpp, depth),
          height,
          lineIndex: 0
        });
      }
      if (depth === 8) {
        this._xComparison = bpp;
      } else if (depth === 16) {
        this._xComparison = bpp * 2;
      } else {
        this._xComparison = 1;
      }
    };
    Filter.prototype.start = function() {
      this.read(
        this._images[this._imageIndex].byteWidth + 1,
        this._reverseFilterLine.bind(this)
      );
    };
    Filter.prototype._unFilterType1 = function(rawData, unfilteredLine, byteWidth) {
      let xComparison = this._xComparison;
      let xBiggerThan = xComparison - 1;
      for (let x2 = 0; x2 < byteWidth; x2++) {
        let rawByte = rawData[1 + x2];
        let f1Left = x2 > xBiggerThan ? unfilteredLine[x2 - xComparison] : 0;
        unfilteredLine[x2] = rawByte + f1Left;
      }
    };
    Filter.prototype._unFilterType2 = function(rawData, unfilteredLine, byteWidth) {
      let lastLine = this._lastLine;
      for (let x2 = 0; x2 < byteWidth; x2++) {
        let rawByte = rawData[1 + x2];
        let f2Up = lastLine ? lastLine[x2] : 0;
        unfilteredLine[x2] = rawByte + f2Up;
      }
    };
    Filter.prototype._unFilterType3 = function(rawData, unfilteredLine, byteWidth) {
      let xComparison = this._xComparison;
      let xBiggerThan = xComparison - 1;
      let lastLine = this._lastLine;
      for (let x2 = 0; x2 < byteWidth; x2++) {
        let rawByte = rawData[1 + x2];
        let f3Up = lastLine ? lastLine[x2] : 0;
        let f3Left = x2 > xBiggerThan ? unfilteredLine[x2 - xComparison] : 0;
        let f3Add = Math.floor((f3Left + f3Up) / 2);
        unfilteredLine[x2] = rawByte + f3Add;
      }
    };
    Filter.prototype._unFilterType4 = function(rawData, unfilteredLine, byteWidth) {
      let xComparison = this._xComparison;
      let xBiggerThan = xComparison - 1;
      let lastLine = this._lastLine;
      for (let x2 = 0; x2 < byteWidth; x2++) {
        let rawByte = rawData[1 + x2];
        let f4Up = lastLine ? lastLine[x2] : 0;
        let f4Left = x2 > xBiggerThan ? unfilteredLine[x2 - xComparison] : 0;
        let f4UpLeft = x2 > xBiggerThan && lastLine ? lastLine[x2 - xComparison] : 0;
        let f4Add = paethPredictor(f4Left, f4Up, f4UpLeft);
        unfilteredLine[x2] = rawByte + f4Add;
      }
    };
    Filter.prototype._reverseFilterLine = function(rawData) {
      let filter = rawData[0];
      let unfilteredLine;
      let currentImage = this._images[this._imageIndex];
      let byteWidth = currentImage.byteWidth;
      if (filter === 0) {
        unfilteredLine = rawData.slice(1, byteWidth + 1);
      } else {
        unfilteredLine = Buffer.alloc(byteWidth);
        switch (filter) {
          case 1:
            this._unFilterType1(rawData, unfilteredLine, byteWidth);
            break;
          case 2:
            this._unFilterType2(rawData, unfilteredLine, byteWidth);
            break;
          case 3:
            this._unFilterType3(rawData, unfilteredLine, byteWidth);
            break;
          case 4:
            this._unFilterType4(rawData, unfilteredLine, byteWidth);
            break;
          default:
            throw new Error("Unrecognised filter type - " + filter);
        }
      }
      this.write(unfilteredLine);
      currentImage.lineIndex++;
      if (currentImage.lineIndex >= currentImage.height) {
        this._lastLine = null;
        this._imageIndex++;
        currentImage = this._images[this._imageIndex];
      } else {
        this._lastLine = unfilteredLine;
      }
      if (currentImage) {
        this.read(currentImage.byteWidth + 1, this._reverseFilterLine.bind(this));
      } else {
        this._lastLine = null;
        this.complete();
      }
    };
  }
});

// node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/filter-parse-async.js
var require_filter_parse_async = __commonJS({
  "node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/filter-parse-async.js"(exports, module) {
    "use strict";
    var util = __require("util");
    var ChunkStream = require_chunkstream();
    var Filter = require_filter_parse();
    var FilterAsync = module.exports = function(bitmapInfo) {
      ChunkStream.call(this);
      let buffers = [];
      let that = this;
      this._filter = new Filter(bitmapInfo, {
        read: this.read.bind(this),
        write: function(buffer) {
          buffers.push(buffer);
        },
        complete: function() {
          that.emit("complete", Buffer.concat(buffers));
        }
      });
      this._filter.start();
    };
    util.inherits(FilterAsync, ChunkStream);
  }
});

// node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/constants.js
var require_constants = __commonJS({
  "node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/constants.js"(exports, module) {
    "use strict";
    module.exports = {
      PNG_SIGNATURE: [137, 80, 78, 71, 13, 10, 26, 10],
      TYPE_IHDR: 1229472850,
      TYPE_IEND: 1229278788,
      TYPE_IDAT: 1229209940,
      TYPE_PLTE: 1347179589,
      TYPE_tRNS: 1951551059,
      // eslint-disable-line camelcase
      TYPE_gAMA: 1732332865,
      // eslint-disable-line camelcase
      // color-type bits
      COLORTYPE_GRAYSCALE: 0,
      COLORTYPE_PALETTE: 1,
      COLORTYPE_COLOR: 2,
      COLORTYPE_ALPHA: 4,
      // e.g. grayscale and alpha
      // color-type combinations
      COLORTYPE_PALETTE_COLOR: 3,
      COLORTYPE_COLOR_ALPHA: 6,
      COLORTYPE_TO_BPP_MAP: {
        0: 1,
        2: 3,
        3: 1,
        4: 2,
        6: 4
      },
      GAMMA_DIVISION: 1e5
    };
  }
});

// node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/crc.js
var require_crc = __commonJS({
  "node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/crc.js"(exports, module) {
    "use strict";
    var crcTable = [];
    (function() {
      for (let i2 = 0; i2 < 256; i2++) {
        let currentCrc = i2;
        for (let j = 0; j < 8; j++) {
          if (currentCrc & 1) {
            currentCrc = 3988292384 ^ currentCrc >>> 1;
          } else {
            currentCrc = currentCrc >>> 1;
          }
        }
        crcTable[i2] = currentCrc;
      }
    })();
    var CrcCalculator = module.exports = function() {
      this._crc = -1;
    };
    CrcCalculator.prototype.write = function(data) {
      for (let i2 = 0; i2 < data.length; i2++) {
        this._crc = crcTable[(this._crc ^ data[i2]) & 255] ^ this._crc >>> 8;
      }
      return true;
    };
    CrcCalculator.prototype.crc32 = function() {
      return this._crc ^ -1;
    };
    CrcCalculator.crc32 = function(buf) {
      let crc = -1;
      for (let i2 = 0; i2 < buf.length; i2++) {
        crc = crcTable[(crc ^ buf[i2]) & 255] ^ crc >>> 8;
      }
      return crc ^ -1;
    };
  }
});

// node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/parser.js
var require_parser = __commonJS({
  "node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/parser.js"(exports, module) {
    "use strict";
    var constants = require_constants();
    var CrcCalculator = require_crc();
    var Parser = module.exports = function(options, dependencies) {
      this._options = options;
      options.checkCRC = options.checkCRC !== false;
      this._hasIHDR = false;
      this._hasIEND = false;
      this._emittedHeadersFinished = false;
      this._palette = [];
      this._colorType = 0;
      this._chunks = {};
      this._chunks[constants.TYPE_IHDR] = this._handleIHDR.bind(this);
      this._chunks[constants.TYPE_IEND] = this._handleIEND.bind(this);
      this._chunks[constants.TYPE_IDAT] = this._handleIDAT.bind(this);
      this._chunks[constants.TYPE_PLTE] = this._handlePLTE.bind(this);
      this._chunks[constants.TYPE_tRNS] = this._handleTRNS.bind(this);
      this._chunks[constants.TYPE_gAMA] = this._handleGAMA.bind(this);
      this.read = dependencies.read;
      this.error = dependencies.error;
      this.metadata = dependencies.metadata;
      this.gamma = dependencies.gamma;
      this.transColor = dependencies.transColor;
      this.palette = dependencies.palette;
      this.parsed = dependencies.parsed;
      this.inflateData = dependencies.inflateData;
      this.finished = dependencies.finished;
      this.simpleTransparency = dependencies.simpleTransparency;
      this.headersFinished = dependencies.headersFinished || function() {
      };
    };
    Parser.prototype.start = function() {
      this.read(constants.PNG_SIGNATURE.length, this._parseSignature.bind(this));
    };
    Parser.prototype._parseSignature = function(data) {
      let signature = constants.PNG_SIGNATURE;
      for (let i2 = 0; i2 < signature.length; i2++) {
        if (data[i2] !== signature[i2]) {
          this.error(new Error("Invalid file signature"));
          return;
        }
      }
      this.read(8, this._parseChunkBegin.bind(this));
    };
    Parser.prototype._parseChunkBegin = function(data) {
      let length = data.readUInt32BE(0);
      let type = data.readUInt32BE(4);
      let name = "";
      for (let i2 = 4; i2 < 8; i2++) {
        name += String.fromCharCode(data[i2]);
      }
      let ancillary = Boolean(data[4] & 32);
      if (!this._hasIHDR && type !== constants.TYPE_IHDR) {
        this.error(new Error("Expected IHDR on beggining"));
        return;
      }
      this._crc = new CrcCalculator();
      this._crc.write(Buffer.from(name));
      if (this._chunks[type]) {
        return this._chunks[type](length);
      }
      if (!ancillary) {
        this.error(new Error("Unsupported critical chunk type " + name));
        return;
      }
      this.read(length + 4, this._skipChunk.bind(this));
    };
    Parser.prototype._skipChunk = function() {
      this.read(8, this._parseChunkBegin.bind(this));
    };
    Parser.prototype._handleChunkEnd = function() {
      this.read(4, this._parseChunkEnd.bind(this));
    };
    Parser.prototype._parseChunkEnd = function(data) {
      let fileCrc = data.readInt32BE(0);
      let calcCrc = this._crc.crc32();
      if (this._options.checkCRC && calcCrc !== fileCrc) {
        this.error(new Error("Crc error - " + fileCrc + " - " + calcCrc));
        return;
      }
      if (!this._hasIEND) {
        this.read(8, this._parseChunkBegin.bind(this));
      }
    };
    Parser.prototype._handleIHDR = function(length) {
      this.read(length, this._parseIHDR.bind(this));
    };
    Parser.prototype._parseIHDR = function(data) {
      this._crc.write(data);
      let width = data.readUInt32BE(0);
      let height = data.readUInt32BE(4);
      let depth = data[8];
      let colorType = data[9];
      let compr = data[10];
      let filter = data[11];
      let interlace = data[12];
      if (depth !== 8 && depth !== 4 && depth !== 2 && depth !== 1 && depth !== 16) {
        this.error(new Error("Unsupported bit depth " + depth));
        return;
      }
      if (!(colorType in constants.COLORTYPE_TO_BPP_MAP)) {
        this.error(new Error("Unsupported color type"));
        return;
      }
      if (compr !== 0) {
        this.error(new Error("Unsupported compression method"));
        return;
      }
      if (filter !== 0) {
        this.error(new Error("Unsupported filter method"));
        return;
      }
      if (interlace !== 0 && interlace !== 1) {
        this.error(new Error("Unsupported interlace method"));
        return;
      }
      this._colorType = colorType;
      let bpp = constants.COLORTYPE_TO_BPP_MAP[this._colorType];
      this._hasIHDR = true;
      this.metadata({
        width,
        height,
        depth,
        interlace: Boolean(interlace),
        palette: Boolean(colorType & constants.COLORTYPE_PALETTE),
        color: Boolean(colorType & constants.COLORTYPE_COLOR),
        alpha: Boolean(colorType & constants.COLORTYPE_ALPHA),
        bpp,
        colorType
      });
      this._handleChunkEnd();
    };
    Parser.prototype._handlePLTE = function(length) {
      this.read(length, this._parsePLTE.bind(this));
    };
    Parser.prototype._parsePLTE = function(data) {
      this._crc.write(data);
      let entries2 = Math.floor(data.length / 3);
      for (let i2 = 0; i2 < entries2; i2++) {
        this._palette.push([data[i2 * 3], data[i2 * 3 + 1], data[i2 * 3 + 2], 255]);
      }
      this.palette(this._palette);
      this._handleChunkEnd();
    };
    Parser.prototype._handleTRNS = function(length) {
      this.simpleTransparency();
      this.read(length, this._parseTRNS.bind(this));
    };
    Parser.prototype._parseTRNS = function(data) {
      this._crc.write(data);
      if (this._colorType === constants.COLORTYPE_PALETTE_COLOR) {
        if (this._palette.length === 0) {
          this.error(new Error("Transparency chunk must be after palette"));
          return;
        }
        if (data.length > this._palette.length) {
          this.error(new Error("More transparent colors than palette size"));
          return;
        }
        for (let i2 = 0; i2 < data.length; i2++) {
          this._palette[i2][3] = data[i2];
        }
        this.palette(this._palette);
      }
      if (this._colorType === constants.COLORTYPE_GRAYSCALE) {
        this.transColor([data.readUInt16BE(0)]);
      }
      if (this._colorType === constants.COLORTYPE_COLOR) {
        this.transColor([
          data.readUInt16BE(0),
          data.readUInt16BE(2),
          data.readUInt16BE(4)
        ]);
      }
      this._handleChunkEnd();
    };
    Parser.prototype._handleGAMA = function(length) {
      this.read(length, this._parseGAMA.bind(this));
    };
    Parser.prototype._parseGAMA = function(data) {
      this._crc.write(data);
      this.gamma(data.readUInt32BE(0) / constants.GAMMA_DIVISION);
      this._handleChunkEnd();
    };
    Parser.prototype._handleIDAT = function(length) {
      if (!this._emittedHeadersFinished) {
        this._emittedHeadersFinished = true;
        this.headersFinished();
      }
      this.read(-length, this._parseIDAT.bind(this, length));
    };
    Parser.prototype._parseIDAT = function(length, data) {
      this._crc.write(data);
      if (this._colorType === constants.COLORTYPE_PALETTE_COLOR && this._palette.length === 0) {
        throw new Error("Expected palette not found");
      }
      this.inflateData(data);
      let leftOverLength = length - data.length;
      if (leftOverLength > 0) {
        this._handleIDAT(leftOverLength);
      } else {
        this._handleChunkEnd();
      }
    };
    Parser.prototype._handleIEND = function(length) {
      this.read(length, this._parseIEND.bind(this));
    };
    Parser.prototype._parseIEND = function(data) {
      this._crc.write(data);
      this._hasIEND = true;
      this._handleChunkEnd();
      if (this.finished) {
        this.finished();
      }
    };
  }
});

// node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/bitmapper.js
var require_bitmapper = __commonJS({
  "node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/bitmapper.js"(exports) {
    "use strict";
    var interlaceUtils = require_interlace();
    var pixelBppMapper = [
      // 0 - dummy entry
      function() {
      },
      // 1 - L
      // 0: 0, 1: 0, 2: 0, 3: 0xff
      function(pxData, data, pxPos, rawPos) {
        if (rawPos === data.length) {
          throw new Error("Ran out of data");
        }
        let pixel = data[rawPos];
        pxData[pxPos] = pixel;
        pxData[pxPos + 1] = pixel;
        pxData[pxPos + 2] = pixel;
        pxData[pxPos + 3] = 255;
      },
      // 2 - LA
      // 0: 0, 1: 0, 2: 0, 3: 1
      function(pxData, data, pxPos, rawPos) {
        if (rawPos + 1 >= data.length) {
          throw new Error("Ran out of data");
        }
        let pixel = data[rawPos];
        pxData[pxPos] = pixel;
        pxData[pxPos + 1] = pixel;
        pxData[pxPos + 2] = pixel;
        pxData[pxPos + 3] = data[rawPos + 1];
      },
      // 3 - RGB
      // 0: 0, 1: 1, 2: 2, 3: 0xff
      function(pxData, data, pxPos, rawPos) {
        if (rawPos + 2 >= data.length) {
          throw new Error("Ran out of data");
        }
        pxData[pxPos] = data[rawPos];
        pxData[pxPos + 1] = data[rawPos + 1];
        pxData[pxPos + 2] = data[rawPos + 2];
        pxData[pxPos + 3] = 255;
      },
      // 4 - RGBA
      // 0: 0, 1: 1, 2: 2, 3: 3
      function(pxData, data, pxPos, rawPos) {
        if (rawPos + 3 >= data.length) {
          throw new Error("Ran out of data");
        }
        pxData[pxPos] = data[rawPos];
        pxData[pxPos + 1] = data[rawPos + 1];
        pxData[pxPos + 2] = data[rawPos + 2];
        pxData[pxPos + 3] = data[rawPos + 3];
      }
    ];
    var pixelBppCustomMapper = [
      // 0 - dummy entry
      function() {
      },
      // 1 - L
      // 0: 0, 1: 0, 2: 0, 3: 0xff
      function(pxData, pixelData, pxPos, maxBit) {
        let pixel = pixelData[0];
        pxData[pxPos] = pixel;
        pxData[pxPos + 1] = pixel;
        pxData[pxPos + 2] = pixel;
        pxData[pxPos + 3] = maxBit;
      },
      // 2 - LA
      // 0: 0, 1: 0, 2: 0, 3: 1
      function(pxData, pixelData, pxPos) {
        let pixel = pixelData[0];
        pxData[pxPos] = pixel;
        pxData[pxPos + 1] = pixel;
        pxData[pxPos + 2] = pixel;
        pxData[pxPos + 3] = pixelData[1];
      },
      // 3 - RGB
      // 0: 0, 1: 1, 2: 2, 3: 0xff
      function(pxData, pixelData, pxPos, maxBit) {
        pxData[pxPos] = pixelData[0];
        pxData[pxPos + 1] = pixelData[1];
        pxData[pxPos + 2] = pixelData[2];
        pxData[pxPos + 3] = maxBit;
      },
      // 4 - RGBA
      // 0: 0, 1: 1, 2: 2, 3: 3
      function(pxData, pixelData, pxPos) {
        pxData[pxPos] = pixelData[0];
        pxData[pxPos + 1] = pixelData[1];
        pxData[pxPos + 2] = pixelData[2];
        pxData[pxPos + 3] = pixelData[3];
      }
    ];
    function bitRetriever(data, depth) {
      let leftOver = [];
      let i2 = 0;
      function split2() {
        if (i2 === data.length) {
          throw new Error("Ran out of data");
        }
        let byte3 = data[i2];
        i2++;
        let byte8, byte7, byte6, byte5, byte4, byte32, byte22, byte1;
        switch (depth) {
          default:
            throw new Error("unrecognised depth");
          case 16:
            byte22 = data[i2];
            i2++;
            leftOver.push((byte3 << 8) + byte22);
            break;
          case 4:
            byte22 = byte3 & 15;
            byte1 = byte3 >> 4;
            leftOver.push(byte1, byte22);
            break;
          case 2:
            byte4 = byte3 & 3;
            byte32 = byte3 >> 2 & 3;
            byte22 = byte3 >> 4 & 3;
            byte1 = byte3 >> 6 & 3;
            leftOver.push(byte1, byte22, byte32, byte4);
            break;
          case 1:
            byte8 = byte3 & 1;
            byte7 = byte3 >> 1 & 1;
            byte6 = byte3 >> 2 & 1;
            byte5 = byte3 >> 3 & 1;
            byte4 = byte3 >> 4 & 1;
            byte32 = byte3 >> 5 & 1;
            byte22 = byte3 >> 6 & 1;
            byte1 = byte3 >> 7 & 1;
            leftOver.push(byte1, byte22, byte32, byte4, byte5, byte6, byte7, byte8);
            break;
        }
      }
      return {
        get: function(count) {
          while (leftOver.length < count) {
            split2();
          }
          let returner = leftOver.slice(0, count);
          leftOver = leftOver.slice(count);
          return returner;
        },
        resetAfterLine: function() {
          leftOver.length = 0;
        },
        end: function() {
          if (i2 !== data.length) {
            throw new Error("extra data found");
          }
        }
      };
    }
    function mapImage8Bit(image, pxData, getPxPos, bpp, data, rawPos) {
      let imageWidth = image.width;
      let imageHeight = image.height;
      let imagePass = image.index;
      for (let y = 0; y < imageHeight; y++) {
        for (let x2 = 0; x2 < imageWidth; x2++) {
          let pxPos = getPxPos(x2, y, imagePass);
          pixelBppMapper[bpp](pxData, data, pxPos, rawPos);
          rawPos += bpp;
        }
      }
      return rawPos;
    }
    function mapImageCustomBit(image, pxData, getPxPos, bpp, bits2, maxBit) {
      let imageWidth = image.width;
      let imageHeight = image.height;
      let imagePass = image.index;
      for (let y = 0; y < imageHeight; y++) {
        for (let x2 = 0; x2 < imageWidth; x2++) {
          let pixelData = bits2.get(bpp);
          let pxPos = getPxPos(x2, y, imagePass);
          pixelBppCustomMapper[bpp](pxData, pixelData, pxPos, maxBit);
        }
        bits2.resetAfterLine();
      }
    }
    exports.dataToBitMap = function(data, bitmapInfo) {
      let width = bitmapInfo.width;
      let height = bitmapInfo.height;
      let depth = bitmapInfo.depth;
      let bpp = bitmapInfo.bpp;
      let interlace = bitmapInfo.interlace;
      let bits2;
      if (depth !== 8) {
        bits2 = bitRetriever(data, depth);
      }
      let pxData;
      if (depth <= 8) {
        pxData = Buffer.alloc(width * height * 4);
      } else {
        pxData = new Uint16Array(width * height * 4);
      }
      let maxBit = Math.pow(2, depth) - 1;
      let rawPos = 0;
      let images;
      let getPxPos;
      if (interlace) {
        images = interlaceUtils.getImagePasses(width, height);
        getPxPos = interlaceUtils.getInterlaceIterator(width, height);
      } else {
        let nonInterlacedPxPos = 0;
        getPxPos = function() {
          let returner = nonInterlacedPxPos;
          nonInterlacedPxPos += 4;
          return returner;
        };
        images = [{ width, height }];
      }
      for (let imageIndex = 0; imageIndex < images.length; imageIndex++) {
        if (depth === 8) {
          rawPos = mapImage8Bit(
            images[imageIndex],
            pxData,
            getPxPos,
            bpp,
            data,
            rawPos
          );
        } else {
          mapImageCustomBit(
            images[imageIndex],
            pxData,
            getPxPos,
            bpp,
            bits2,
            maxBit
          );
        }
      }
      if (depth === 8) {
        if (rawPos !== data.length) {
          throw new Error("extra data found");
        }
      } else {
        bits2.end();
      }
      return pxData;
    };
  }
});

// node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/format-normaliser.js
var require_format_normaliser = __commonJS({
  "node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/format-normaliser.js"(exports, module) {
    "use strict";
    function dePalette(indata, outdata, width, height, palette) {
      let pxPos = 0;
      for (let y = 0; y < height; y++) {
        for (let x2 = 0; x2 < width; x2++) {
          let color = palette[indata[pxPos]];
          if (!color) {
            throw new Error("index " + indata[pxPos] + " not in palette");
          }
          for (let i2 = 0; i2 < 4; i2++) {
            outdata[pxPos + i2] = color[i2];
          }
          pxPos += 4;
        }
      }
    }
    function replaceTransparentColor(indata, outdata, width, height, transColor) {
      let pxPos = 0;
      for (let y = 0; y < height; y++) {
        for (let x2 = 0; x2 < width; x2++) {
          let makeTrans = false;
          if (transColor.length === 1) {
            if (transColor[0] === indata[pxPos]) {
              makeTrans = true;
            }
          } else if (transColor[0] === indata[pxPos] && transColor[1] === indata[pxPos + 1] && transColor[2] === indata[pxPos + 2]) {
            makeTrans = true;
          }
          if (makeTrans) {
            for (let i2 = 0; i2 < 4; i2++) {
              outdata[pxPos + i2] = 0;
            }
          }
          pxPos += 4;
        }
      }
    }
    function scaleDepth(indata, outdata, width, height, depth) {
      let maxOutSample = 255;
      let maxInSample = Math.pow(2, depth) - 1;
      let pxPos = 0;
      for (let y = 0; y < height; y++) {
        for (let x2 = 0; x2 < width; x2++) {
          for (let i2 = 0; i2 < 4; i2++) {
            outdata[pxPos + i2] = Math.floor(
              indata[pxPos + i2] * maxOutSample / maxInSample + 0.5
            );
          }
          pxPos += 4;
        }
      }
    }
    module.exports = function(indata, imageData, skipRescale = false) {
      let depth = imageData.depth;
      let width = imageData.width;
      let height = imageData.height;
      let colorType = imageData.colorType;
      let transColor = imageData.transColor;
      let palette = imageData.palette;
      let outdata = indata;
      if (colorType === 3) {
        dePalette(indata, outdata, width, height, palette);
      } else {
        if (transColor) {
          replaceTransparentColor(indata, outdata, width, height, transColor);
        }
        if (depth !== 8 && !skipRescale) {
          if (depth === 16) {
            outdata = Buffer.alloc(width * height * 4);
          }
          scaleDepth(indata, outdata, width, height, depth);
        }
      }
      return outdata;
    };
  }
});

// node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/parser-async.js
var require_parser_async = __commonJS({
  "node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/parser-async.js"(exports, module) {
    "use strict";
    var util = __require("util");
    var zlib = __require("zlib");
    var ChunkStream = require_chunkstream();
    var FilterAsync = require_filter_parse_async();
    var Parser = require_parser();
    var bitmapper = require_bitmapper();
    var formatNormaliser = require_format_normaliser();
    var ParserAsync = module.exports = function(options) {
      ChunkStream.call(this);
      this._parser = new Parser(options, {
        read: this.read.bind(this),
        error: this._handleError.bind(this),
        metadata: this._handleMetaData.bind(this),
        gamma: this.emit.bind(this, "gamma"),
        palette: this._handlePalette.bind(this),
        transColor: this._handleTransColor.bind(this),
        finished: this._finished.bind(this),
        inflateData: this._inflateData.bind(this),
        simpleTransparency: this._simpleTransparency.bind(this),
        headersFinished: this._headersFinished.bind(this)
      });
      this._options = options;
      this.writable = true;
      this._parser.start();
    };
    util.inherits(ParserAsync, ChunkStream);
    ParserAsync.prototype._handleError = function(err2) {
      this.emit("error", err2);
      this.writable = false;
      this.destroy();
      if (this._inflate && this._inflate.destroy) {
        this._inflate.destroy();
      }
      if (this._filter) {
        this._filter.destroy();
        this._filter.on("error", function() {
        });
      }
      this.errord = true;
    };
    ParserAsync.prototype._inflateData = function(data) {
      if (!this._inflate) {
        if (this._bitmapInfo.interlace) {
          this._inflate = zlib.createInflate();
          this._inflate.on("error", this.emit.bind(this, "error"));
          this._filter.on("complete", this._complete.bind(this));
          this._inflate.pipe(this._filter);
        } else {
          let rowSize = (this._bitmapInfo.width * this._bitmapInfo.bpp * this._bitmapInfo.depth + 7 >> 3) + 1;
          let imageSize = rowSize * this._bitmapInfo.height;
          let chunkSize = Math.max(imageSize, zlib.Z_MIN_CHUNK);
          this._inflate = zlib.createInflate({ chunkSize });
          let leftToInflate = imageSize;
          let emitError = this.emit.bind(this, "error");
          this._inflate.on("error", function(err2) {
            if (!leftToInflate) {
              return;
            }
            emitError(err2);
          });
          this._filter.on("complete", this._complete.bind(this));
          let filterWrite = this._filter.write.bind(this._filter);
          this._inflate.on("data", function(chunk) {
            if (!leftToInflate) {
              return;
            }
            if (chunk.length > leftToInflate) {
              chunk = chunk.slice(0, leftToInflate);
            }
            leftToInflate -= chunk.length;
            filterWrite(chunk);
          });
          this._inflate.on("end", this._filter.end.bind(this._filter));
        }
      }
      this._inflate.write(data);
    };
    ParserAsync.prototype._handleMetaData = function(metaData) {
      this._metaData = metaData;
      this._bitmapInfo = Object.create(metaData);
      this._filter = new FilterAsync(this._bitmapInfo);
    };
    ParserAsync.prototype._handleTransColor = function(transColor) {
      this._bitmapInfo.transColor = transColor;
    };
    ParserAsync.prototype._handlePalette = function(palette) {
      this._bitmapInfo.palette = palette;
    };
    ParserAsync.prototype._simpleTransparency = function() {
      this._metaData.alpha = true;
    };
    ParserAsync.prototype._headersFinished = function() {
      this.emit("metadata", this._metaData);
    };
    ParserAsync.prototype._finished = function() {
      if (this.errord) {
        return;
      }
      if (!this._inflate) {
        this.emit("error", "No Inflate block");
      } else {
        this._inflate.end();
      }
    };
    ParserAsync.prototype._complete = function(filteredData) {
      if (this.errord) {
        return;
      }
      let normalisedBitmapData;
      try {
        let bitmapData = bitmapper.dataToBitMap(filteredData, this._bitmapInfo);
        normalisedBitmapData = formatNormaliser(
          bitmapData,
          this._bitmapInfo,
          this._options.skipRescale
        );
        bitmapData = null;
      } catch (ex) {
        this._handleError(ex);
        return;
      }
      this.emit("parsed", normalisedBitmapData);
    };
  }
});

// node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/bitpacker.js
var require_bitpacker = __commonJS({
  "node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/bitpacker.js"(exports, module) {
    "use strict";
    var constants = require_constants();
    module.exports = function(dataIn, width, height, options) {
      let outHasAlpha = [constants.COLORTYPE_COLOR_ALPHA, constants.COLORTYPE_ALPHA].indexOf(
        options.colorType
      ) !== -1;
      if (options.colorType === options.inputColorType) {
        let bigEndian = (function() {
          let buffer = new ArrayBuffer(2);
          new DataView(buffer).setInt16(
            0,
            256,
            true
            /* littleEndian */
          );
          return new Int16Array(buffer)[0] !== 256;
        })();
        if (options.bitDepth === 8 || options.bitDepth === 16 && bigEndian) {
          return dataIn;
        }
      }
      let data = options.bitDepth !== 16 ? dataIn : new Uint16Array(dataIn.buffer);
      let maxValue = 255;
      let inBpp = constants.COLORTYPE_TO_BPP_MAP[options.inputColorType];
      if (inBpp === 4 && !options.inputHasAlpha) {
        inBpp = 3;
      }
      let outBpp = constants.COLORTYPE_TO_BPP_MAP[options.colorType];
      if (options.bitDepth === 16) {
        maxValue = 65535;
        outBpp *= 2;
      }
      let outData = Buffer.alloc(width * height * outBpp);
      let inIndex = 0;
      let outIndex = 0;
      let bgColor = options.bgColor || {};
      if (bgColor.red === void 0) {
        bgColor.red = maxValue;
      }
      if (bgColor.green === void 0) {
        bgColor.green = maxValue;
      }
      if (bgColor.blue === void 0) {
        bgColor.blue = maxValue;
      }
      function getRGBA() {
        let red;
        let green;
        let blue;
        let alpha = maxValue;
        switch (options.inputColorType) {
          case constants.COLORTYPE_COLOR_ALPHA:
            alpha = data[inIndex + 3];
            red = data[inIndex];
            green = data[inIndex + 1];
            blue = data[inIndex + 2];
            break;
          case constants.COLORTYPE_COLOR:
            red = data[inIndex];
            green = data[inIndex + 1];
            blue = data[inIndex + 2];
            break;
          case constants.COLORTYPE_ALPHA:
            alpha = data[inIndex + 1];
            red = data[inIndex];
            green = red;
            blue = red;
            break;
          case constants.COLORTYPE_GRAYSCALE:
            red = data[inIndex];
            green = red;
            blue = red;
            break;
          default:
            throw new Error(
              "input color type:" + options.inputColorType + " is not supported at present"
            );
        }
        if (options.inputHasAlpha) {
          if (!outHasAlpha) {
            alpha /= maxValue;
            red = Math.min(
              Math.max(Math.round((1 - alpha) * bgColor.red + alpha * red), 0),
              maxValue
            );
            green = Math.min(
              Math.max(Math.round((1 - alpha) * bgColor.green + alpha * green), 0),
              maxValue
            );
            blue = Math.min(
              Math.max(Math.round((1 - alpha) * bgColor.blue + alpha * blue), 0),
              maxValue
            );
          }
        }
        return { red, green, blue, alpha };
      }
      for (let y = 0; y < height; y++) {
        for (let x2 = 0; x2 < width; x2++) {
          let rgba = getRGBA(data, inIndex);
          switch (options.colorType) {
            case constants.COLORTYPE_COLOR_ALPHA:
            case constants.COLORTYPE_COLOR:
              if (options.bitDepth === 8) {
                outData[outIndex] = rgba.red;
                outData[outIndex + 1] = rgba.green;
                outData[outIndex + 2] = rgba.blue;
                if (outHasAlpha) {
                  outData[outIndex + 3] = rgba.alpha;
                }
              } else {
                outData.writeUInt16BE(rgba.red, outIndex);
                outData.writeUInt16BE(rgba.green, outIndex + 2);
                outData.writeUInt16BE(rgba.blue, outIndex + 4);
                if (outHasAlpha) {
                  outData.writeUInt16BE(rgba.alpha, outIndex + 6);
                }
              }
              break;
            case constants.COLORTYPE_ALPHA:
            case constants.COLORTYPE_GRAYSCALE: {
              let grayscale = (rgba.red + rgba.green + rgba.blue) / 3;
              if (options.bitDepth === 8) {
                outData[outIndex] = grayscale;
                if (outHasAlpha) {
                  outData[outIndex + 1] = rgba.alpha;
                }
              } else {
                outData.writeUInt16BE(grayscale, outIndex);
                if (outHasAlpha) {
                  outData.writeUInt16BE(rgba.alpha, outIndex + 2);
                }
              }
              break;
            }
            default:
              throw new Error("unrecognised color Type " + options.colorType);
          }
          inIndex += inBpp;
          outIndex += outBpp;
        }
      }
      return outData;
    };
  }
});

// node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/filter-pack.js
var require_filter_pack = __commonJS({
  "node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/filter-pack.js"(exports, module) {
    "use strict";
    var paethPredictor = require_paeth_predictor();
    function filterNone(pxData, pxPos, byteWidth, rawData, rawPos) {
      for (let x2 = 0; x2 < byteWidth; x2++) {
        rawData[rawPos + x2] = pxData[pxPos + x2];
      }
    }
    function filterSumNone(pxData, pxPos, byteWidth) {
      let sum2 = 0;
      let length = pxPos + byteWidth;
      for (let i2 = pxPos; i2 < length; i2++) {
        sum2 += Math.abs(pxData[i2]);
      }
      return sum2;
    }
    function filterSub(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
      for (let x2 = 0; x2 < byteWidth; x2++) {
        let left = x2 >= bpp ? pxData[pxPos + x2 - bpp] : 0;
        let val = pxData[pxPos + x2] - left;
        rawData[rawPos + x2] = val;
      }
    }
    function filterSumSub(pxData, pxPos, byteWidth, bpp) {
      let sum2 = 0;
      for (let x2 = 0; x2 < byteWidth; x2++) {
        let left = x2 >= bpp ? pxData[pxPos + x2 - bpp] : 0;
        let val = pxData[pxPos + x2] - left;
        sum2 += Math.abs(val);
      }
      return sum2;
    }
    function filterUp(pxData, pxPos, byteWidth, rawData, rawPos) {
      for (let x2 = 0; x2 < byteWidth; x2++) {
        let up = pxPos > 0 ? pxData[pxPos + x2 - byteWidth] : 0;
        let val = pxData[pxPos + x2] - up;
        rawData[rawPos + x2] = val;
      }
    }
    function filterSumUp(pxData, pxPos, byteWidth) {
      let sum2 = 0;
      let length = pxPos + byteWidth;
      for (let x2 = pxPos; x2 < length; x2++) {
        let up = pxPos > 0 ? pxData[x2 - byteWidth] : 0;
        let val = pxData[x2] - up;
        sum2 += Math.abs(val);
      }
      return sum2;
    }
    function filterAvg(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
      for (let x2 = 0; x2 < byteWidth; x2++) {
        let left = x2 >= bpp ? pxData[pxPos + x2 - bpp] : 0;
        let up = pxPos > 0 ? pxData[pxPos + x2 - byteWidth] : 0;
        let val = pxData[pxPos + x2] - (left + up >> 1);
        rawData[rawPos + x2] = val;
      }
    }
    function filterSumAvg(pxData, pxPos, byteWidth, bpp) {
      let sum2 = 0;
      for (let x2 = 0; x2 < byteWidth; x2++) {
        let left = x2 >= bpp ? pxData[pxPos + x2 - bpp] : 0;
        let up = pxPos > 0 ? pxData[pxPos + x2 - byteWidth] : 0;
        let val = pxData[pxPos + x2] - (left + up >> 1);
        sum2 += Math.abs(val);
      }
      return sum2;
    }
    function filterPaeth(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
      for (let x2 = 0; x2 < byteWidth; x2++) {
        let left = x2 >= bpp ? pxData[pxPos + x2 - bpp] : 0;
        let up = pxPos > 0 ? pxData[pxPos + x2 - byteWidth] : 0;
        let upleft = pxPos > 0 && x2 >= bpp ? pxData[pxPos + x2 - (byteWidth + bpp)] : 0;
        let val = pxData[pxPos + x2] - paethPredictor(left, up, upleft);
        rawData[rawPos + x2] = val;
      }
    }
    function filterSumPaeth(pxData, pxPos, byteWidth, bpp) {
      let sum2 = 0;
      for (let x2 = 0; x2 < byteWidth; x2++) {
        let left = x2 >= bpp ? pxData[pxPos + x2 - bpp] : 0;
        let up = pxPos > 0 ? pxData[pxPos + x2 - byteWidth] : 0;
        let upleft = pxPos > 0 && x2 >= bpp ? pxData[pxPos + x2 - (byteWidth + bpp)] : 0;
        let val = pxData[pxPos + x2] - paethPredictor(left, up, upleft);
        sum2 += Math.abs(val);
      }
      return sum2;
    }
    var filters = {
      0: filterNone,
      1: filterSub,
      2: filterUp,
      3: filterAvg,
      4: filterPaeth
    };
    var filterSums = {
      0: filterSumNone,
      1: filterSumSub,
      2: filterSumUp,
      3: filterSumAvg,
      4: filterSumPaeth
    };
    module.exports = function(pxData, width, height, options, bpp) {
      let filterTypes;
      if (!("filterType" in options) || options.filterType === -1) {
        filterTypes = [0, 1, 2, 3, 4];
      } else if (typeof options.filterType === "number") {
        filterTypes = [options.filterType];
      } else {
        throw new Error("unrecognised filter types");
      }
      if (options.bitDepth === 16) {
        bpp *= 2;
      }
      let byteWidth = width * bpp;
      let rawPos = 0;
      let pxPos = 0;
      let rawData = Buffer.alloc((byteWidth + 1) * height);
      let sel = filterTypes[0];
      for (let y = 0; y < height; y++) {
        if (filterTypes.length > 1) {
          let min = Infinity;
          for (let i2 = 0; i2 < filterTypes.length; i2++) {
            let sum2 = filterSums[filterTypes[i2]](pxData, pxPos, byteWidth, bpp);
            if (sum2 < min) {
              sel = filterTypes[i2];
              min = sum2;
            }
          }
        }
        rawData[rawPos] = sel;
        rawPos++;
        filters[sel](pxData, pxPos, byteWidth, rawData, rawPos, bpp);
        rawPos += byteWidth;
        pxPos += byteWidth;
      }
      return rawData;
    };
  }
});

// node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/packer.js
var require_packer = __commonJS({
  "node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/packer.js"(exports, module) {
    "use strict";
    var constants = require_constants();
    var CrcStream = require_crc();
    var bitPacker = require_bitpacker();
    var filter = require_filter_pack();
    var zlib = __require("zlib");
    var Packer = module.exports = function(options) {
      this._options = options;
      options.deflateChunkSize = options.deflateChunkSize || 32 * 1024;
      options.deflateLevel = options.deflateLevel != null ? options.deflateLevel : 9;
      options.deflateStrategy = options.deflateStrategy != null ? options.deflateStrategy : 3;
      options.inputHasAlpha = options.inputHasAlpha != null ? options.inputHasAlpha : true;
      options.deflateFactory = options.deflateFactory || zlib.createDeflate;
      options.bitDepth = options.bitDepth || 8;
      options.colorType = typeof options.colorType === "number" ? options.colorType : constants.COLORTYPE_COLOR_ALPHA;
      options.inputColorType = typeof options.inputColorType === "number" ? options.inputColorType : constants.COLORTYPE_COLOR_ALPHA;
      if ([
        constants.COLORTYPE_GRAYSCALE,
        constants.COLORTYPE_COLOR,
        constants.COLORTYPE_COLOR_ALPHA,
        constants.COLORTYPE_ALPHA
      ].indexOf(options.colorType) === -1) {
        throw new Error(
          "option color type:" + options.colorType + " is not supported at present"
        );
      }
      if ([
        constants.COLORTYPE_GRAYSCALE,
        constants.COLORTYPE_COLOR,
        constants.COLORTYPE_COLOR_ALPHA,
        constants.COLORTYPE_ALPHA
      ].indexOf(options.inputColorType) === -1) {
        throw new Error(
          "option input color type:" + options.inputColorType + " is not supported at present"
        );
      }
      if (options.bitDepth !== 8 && options.bitDepth !== 16) {
        throw new Error(
          "option bit depth:" + options.bitDepth + " is not supported at present"
        );
      }
    };
    Packer.prototype.getDeflateOptions = function() {
      return {
        chunkSize: this._options.deflateChunkSize,
        level: this._options.deflateLevel,
        strategy: this._options.deflateStrategy
      };
    };
    Packer.prototype.createDeflate = function() {
      return this._options.deflateFactory(this.getDeflateOptions());
    };
    Packer.prototype.filterData = function(data, width, height) {
      let packedData = bitPacker(data, width, height, this._options);
      let bpp = constants.COLORTYPE_TO_BPP_MAP[this._options.colorType];
      let filteredData = filter(packedData, width, height, this._options, bpp);
      return filteredData;
    };
    Packer.prototype._packChunk = function(type, data) {
      let len = data ? data.length : 0;
      let buf = Buffer.alloc(len + 12);
      buf.writeUInt32BE(len, 0);
      buf.writeUInt32BE(type, 4);
      if (data) {
        data.copy(buf, 8);
      }
      buf.writeInt32BE(
        CrcStream.crc32(buf.slice(4, buf.length - 4)),
        buf.length - 4
      );
      return buf;
    };
    Packer.prototype.packGAMA = function(gamma) {
      let buf = Buffer.alloc(4);
      buf.writeUInt32BE(Math.floor(gamma * constants.GAMMA_DIVISION), 0);
      return this._packChunk(constants.TYPE_gAMA, buf);
    };
    Packer.prototype.packIHDR = function(width, height) {
      let buf = Buffer.alloc(13);
      buf.writeUInt32BE(width, 0);
      buf.writeUInt32BE(height, 4);
      buf[8] = this._options.bitDepth;
      buf[9] = this._options.colorType;
      buf[10] = 0;
      buf[11] = 0;
      buf[12] = 0;
      return this._packChunk(constants.TYPE_IHDR, buf);
    };
    Packer.prototype.packIDAT = function(data) {
      return this._packChunk(constants.TYPE_IDAT, data);
    };
    Packer.prototype.packIEND = function() {
      return this._packChunk(constants.TYPE_IEND, null);
    };
  }
});

// node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/packer-async.js
var require_packer_async = __commonJS({
  "node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/packer-async.js"(exports, module) {
    "use strict";
    var util = __require("util");
    var Stream = __require("stream");
    var constants = require_constants();
    var Packer = require_packer();
    var PackerAsync = module.exports = function(opt) {
      Stream.call(this);
      let options = opt || {};
      this._packer = new Packer(options);
      this._deflate = this._packer.createDeflate();
      this.readable = true;
    };
    util.inherits(PackerAsync, Stream);
    PackerAsync.prototype.pack = function(data, width, height, gamma) {
      this.emit("data", Buffer.from(constants.PNG_SIGNATURE));
      this.emit("data", this._packer.packIHDR(width, height));
      if (gamma) {
        this.emit("data", this._packer.packGAMA(gamma));
      }
      let filteredData = this._packer.filterData(data, width, height);
      this._deflate.on("error", this.emit.bind(this, "error"));
      this._deflate.on(
        "data",
        function(compressedData) {
          this.emit("data", this._packer.packIDAT(compressedData));
        }.bind(this)
      );
      this._deflate.on(
        "end",
        function() {
          this.emit("data", this._packer.packIEND());
          this.emit("end");
        }.bind(this)
      );
      this._deflate.end(filteredData);
    };
  }
});

// node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/sync-inflate.js
var require_sync_inflate = __commonJS({
  "node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/sync-inflate.js"(exports, module) {
    "use strict";
    var assert = __require("assert").ok;
    var zlib = __require("zlib");
    var util = __require("util");
    var kMaxLength = __require("buffer").kMaxLength;
    function Inflate(opts) {
      if (!(this instanceof Inflate)) {
        return new Inflate(opts);
      }
      if (opts && opts.chunkSize < zlib.Z_MIN_CHUNK) {
        opts.chunkSize = zlib.Z_MIN_CHUNK;
      }
      zlib.Inflate.call(this, opts);
      this._offset = this._offset === void 0 ? this._outOffset : this._offset;
      this._buffer = this._buffer || this._outBuffer;
      if (opts && opts.maxLength != null) {
        this._maxLength = opts.maxLength;
      }
    }
    function createInflate(opts) {
      return new Inflate(opts);
    }
    function _close(engine, callback) {
      if (callback) {
        process.nextTick(callback);
      }
      if (!engine._handle) {
        return;
      }
      engine._handle.close();
      engine._handle = null;
    }
    Inflate.prototype._processChunk = function(chunk, flushFlag, asyncCb) {
      if (typeof asyncCb === "function") {
        return zlib.Inflate._processChunk.call(this, chunk, flushFlag, asyncCb);
      }
      let self = this;
      let availInBefore = chunk && chunk.length;
      let availOutBefore = this._chunkSize - this._offset;
      let leftToInflate = this._maxLength;
      let inOff = 0;
      let buffers = [];
      let nread = 0;
      let error;
      this.on("error", function(err2) {
        error = err2;
      });
      function handleChunk(availInAfter, availOutAfter) {
        if (self._hadError) {
          return;
        }
        let have = availOutBefore - availOutAfter;
        assert(have >= 0, "have should not go down");
        if (have > 0) {
          let out = self._buffer.slice(self._offset, self._offset + have);
          self._offset += have;
          if (out.length > leftToInflate) {
            out = out.slice(0, leftToInflate);
          }
          buffers.push(out);
          nread += out.length;
          leftToInflate -= out.length;
          if (leftToInflate === 0) {
            return false;
          }
        }
        if (availOutAfter === 0 || self._offset >= self._chunkSize) {
          availOutBefore = self._chunkSize;
          self._offset = 0;
          self._buffer = Buffer.allocUnsafe(self._chunkSize);
        }
        if (availOutAfter === 0) {
          inOff += availInBefore - availInAfter;
          availInBefore = availInAfter;
          return true;
        }
        return false;
      }
      assert(this._handle, "zlib binding closed");
      let res;
      do {
        res = this._handle.writeSync(
          flushFlag,
          chunk,
          // in
          inOff,
          // in_off
          availInBefore,
          // in_len
          this._buffer,
          // out
          this._offset,
          //out_off
          availOutBefore
        );
        res = res || this._writeState;
      } while (!this._hadError && handleChunk(res[0], res[1]));
      if (this._hadError) {
        throw error;
      }
      if (nread >= kMaxLength) {
        _close(this);
        throw new RangeError(
          "Cannot create final Buffer. It would be larger than 0x" + kMaxLength.toString(16) + " bytes"
        );
      }
      let buf = Buffer.concat(buffers, nread);
      _close(this);
      return buf;
    };
    util.inherits(Inflate, zlib.Inflate);
    function zlibBufferSync(engine, buffer) {
      if (typeof buffer === "string") {
        buffer = Buffer.from(buffer);
      }
      if (!(buffer instanceof Buffer)) {
        throw new TypeError("Not a string or buffer");
      }
      let flushFlag = engine._finishFlushFlag;
      if (flushFlag == null) {
        flushFlag = zlib.Z_FINISH;
      }
      return engine._processChunk(buffer, flushFlag);
    }
    function inflateSync2(buffer, opts) {
      return zlibBufferSync(new Inflate(opts), buffer);
    }
    module.exports = exports = inflateSync2;
    exports.Inflate = Inflate;
    exports.createInflate = createInflate;
    exports.inflateSync = inflateSync2;
  }
});

// node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/sync-reader.js
var require_sync_reader = __commonJS({
  "node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/sync-reader.js"(exports, module) {
    "use strict";
    var SyncReader = module.exports = function(buffer) {
      this._buffer = buffer;
      this._reads = [];
    };
    SyncReader.prototype.read = function(length, callback) {
      this._reads.push({
        length: Math.abs(length),
        // if length < 0 then at most this length
        allowLess: length < 0,
        func: callback
      });
    };
    SyncReader.prototype.process = function() {
      while (this._reads.length > 0 && this._buffer.length) {
        let read2 = this._reads[0];
        if (this._buffer.length && (this._buffer.length >= read2.length || read2.allowLess)) {
          this._reads.shift();
          let buf = this._buffer;
          this._buffer = buf.slice(read2.length);
          read2.func.call(this, buf.slice(0, read2.length));
        } else {
          break;
        }
      }
      if (this._reads.length > 0) {
        throw new Error("There are some read requests waitng on finished stream");
      }
      if (this._buffer.length > 0) {
        throw new Error("unrecognised content at end of stream");
      }
    };
  }
});

// node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/filter-parse-sync.js
var require_filter_parse_sync = __commonJS({
  "node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/filter-parse-sync.js"(exports) {
    "use strict";
    var SyncReader = require_sync_reader();
    var Filter = require_filter_parse();
    exports.process = function(inBuffer, bitmapInfo) {
      let outBuffers = [];
      let reader = new SyncReader(inBuffer);
      let filter = new Filter(bitmapInfo, {
        read: reader.read.bind(reader),
        write: function(bufferPart) {
          outBuffers.push(bufferPart);
        },
        complete: function() {
        }
      });
      filter.start();
      reader.process();
      return Buffer.concat(outBuffers);
    };
  }
});

// node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/parser-sync.js
var require_parser_sync = __commonJS({
  "node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/parser-sync.js"(exports, module) {
    "use strict";
    var hasSyncZlib = true;
    var zlib = __require("zlib");
    var inflateSync2 = require_sync_inflate();
    if (!zlib.deflateSync) {
      hasSyncZlib = false;
    }
    var SyncReader = require_sync_reader();
    var FilterSync = require_filter_parse_sync();
    var Parser = require_parser();
    var bitmapper = require_bitmapper();
    var formatNormaliser = require_format_normaliser();
    module.exports = function(buffer, options) {
      if (!hasSyncZlib) {
        throw new Error(
          "To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0"
        );
      }
      let err2;
      function handleError(_err_) {
        err2 = _err_;
      }
      let metaData;
      function handleMetaData(_metaData_) {
        metaData = _metaData_;
      }
      function handleTransColor(transColor) {
        metaData.transColor = transColor;
      }
      function handlePalette(palette) {
        metaData.palette = palette;
      }
      function handleSimpleTransparency() {
        metaData.alpha = true;
      }
      let gamma;
      function handleGamma(_gamma_) {
        gamma = _gamma_;
      }
      let inflateDataList = [];
      function handleInflateData(inflatedData2) {
        inflateDataList.push(inflatedData2);
      }
      let reader = new SyncReader(buffer);
      let parser = new Parser(options, {
        read: reader.read.bind(reader),
        error: handleError,
        metadata: handleMetaData,
        gamma: handleGamma,
        palette: handlePalette,
        transColor: handleTransColor,
        inflateData: handleInflateData,
        simpleTransparency: handleSimpleTransparency
      });
      parser.start();
      reader.process();
      if (err2) {
        throw err2;
      }
      let inflateData = Buffer.concat(inflateDataList);
      inflateDataList.length = 0;
      let inflatedData;
      if (metaData.interlace) {
        inflatedData = zlib.inflateSync(inflateData);
      } else {
        let rowSize = (metaData.width * metaData.bpp * metaData.depth + 7 >> 3) + 1;
        let imageSize = rowSize * metaData.height;
        inflatedData = inflateSync2(inflateData, {
          chunkSize: imageSize,
          maxLength: imageSize
        });
      }
      inflateData = null;
      if (!inflatedData || !inflatedData.length) {
        throw new Error("bad png - invalid inflate data response");
      }
      let unfilteredData = FilterSync.process(inflatedData, metaData);
      inflateData = null;
      let bitmapData = bitmapper.dataToBitMap(unfilteredData, metaData);
      unfilteredData = null;
      let normalisedBitmapData = formatNormaliser(
        bitmapData,
        metaData,
        options.skipRescale
      );
      metaData.data = normalisedBitmapData;
      metaData.gamma = gamma || 0;
      return metaData;
    };
  }
});

// node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/packer-sync.js
var require_packer_sync = __commonJS({
  "node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/packer-sync.js"(exports, module) {
    "use strict";
    var hasSyncZlib = true;
    var zlib = __require("zlib");
    if (!zlib.deflateSync) {
      hasSyncZlib = false;
    }
    var constants = require_constants();
    var Packer = require_packer();
    module.exports = function(metaData, opt) {
      if (!hasSyncZlib) {
        throw new Error(
          "To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0"
        );
      }
      let options = opt || {};
      let packer = new Packer(options);
      let chunks = [];
      chunks.push(Buffer.from(constants.PNG_SIGNATURE));
      chunks.push(packer.packIHDR(metaData.width, metaData.height));
      if (metaData.gamma) {
        chunks.push(packer.packGAMA(metaData.gamma));
      }
      let filteredData = packer.filterData(
        metaData.data,
        metaData.width,
        metaData.height
      );
      let compressedData = zlib.deflateSync(
        filteredData,
        packer.getDeflateOptions()
      );
      filteredData = null;
      if (!compressedData || !compressedData.length) {
        throw new Error("bad png - invalid compressed data response");
      }
      chunks.push(packer.packIDAT(compressedData));
      chunks.push(packer.packIEND());
      return Buffer.concat(chunks);
    };
  }
});

// node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/png-sync.js
var require_png_sync = __commonJS({
  "node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/png-sync.js"(exports) {
    "use strict";
    var parse3 = require_parser_sync();
    var pack2 = require_packer_sync();
    exports.read = function(buffer, options) {
      return parse3(buffer, options || {});
    };
    exports.write = function(png, options) {
      return pack2(png, options);
    };
  }
});

// node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/png.js
var require_png = __commonJS({
  "node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/lib/png.js"(exports) {
    "use strict";
    var util = __require("util");
    var Stream = __require("stream");
    var Parser = require_parser_async();
    var Packer = require_packer_async();
    var PNGSync = require_png_sync();
    var PNG2 = exports.PNG = function(options) {
      Stream.call(this);
      options = options || {};
      this.width = options.width | 0;
      this.height = options.height | 0;
      this.data = this.width > 0 && this.height > 0 ? Buffer.alloc(4 * this.width * this.height) : null;
      if (options.fill && this.data) {
        this.data.fill(0);
      }
      this.gamma = 0;
      this.readable = this.writable = true;
      this._parser = new Parser(options);
      this._parser.on("error", this.emit.bind(this, "error"));
      this._parser.on("close", this._handleClose.bind(this));
      this._parser.on("metadata", this._metadata.bind(this));
      this._parser.on("gamma", this._gamma.bind(this));
      this._parser.on(
        "parsed",
        function(data) {
          this.data = data;
          this.emit("parsed", data);
        }.bind(this)
      );
      this._packer = new Packer(options);
      this._packer.on("data", this.emit.bind(this, "data"));
      this._packer.on("end", this.emit.bind(this, "end"));
      this._parser.on("close", this._handleClose.bind(this));
      this._packer.on("error", this.emit.bind(this, "error"));
    };
    util.inherits(PNG2, Stream);
    PNG2.sync = PNGSync;
    PNG2.prototype.pack = function() {
      if (!this.data || !this.data.length) {
        this.emit("error", "No data provided");
        return this;
      }
      process.nextTick(
        function() {
          this._packer.pack(this.data, this.width, this.height, this.gamma);
        }.bind(this)
      );
      return this;
    };
    PNG2.prototype.parse = function(data, callback) {
      if (callback) {
        let onParsed, onError;
        onParsed = function(parsedData) {
          this.removeListener("error", onError);
          this.data = parsedData;
          callback(null, this);
        }.bind(this);
        onError = function(err2) {
          this.removeListener("parsed", onParsed);
          callback(err2, null);
        }.bind(this);
        this.once("parsed", onParsed);
        this.once("error", onError);
      }
      this.end(data);
      return this;
    };
    PNG2.prototype.write = function(data) {
      this._parser.write(data);
      return true;
    };
    PNG2.prototype.end = function(data) {
      this._parser.end(data);
    };
    PNG2.prototype._metadata = function(metadata) {
      this.width = metadata.width;
      this.height = metadata.height;
      this.emit("metadata", metadata);
    };
    PNG2.prototype._gamma = function(gamma) {
      this.gamma = gamma;
    };
    PNG2.prototype._handleClose = function() {
      if (!this._parser.writable && !this._packer.readable) {
        this.emit("close");
      }
    };
    PNG2.bitblt = function(src, dst, srcX, srcY, width, height, deltaX, deltaY) {
      srcX |= 0;
      srcY |= 0;
      width |= 0;
      height |= 0;
      deltaX |= 0;
      deltaY |= 0;
      if (srcX > src.width || srcY > src.height || srcX + width > src.width || srcY + height > src.height) {
        throw new Error("bitblt reading outside image");
      }
      if (deltaX > dst.width || deltaY > dst.height || deltaX + width > dst.width || deltaY + height > dst.height) {
        throw new Error("bitblt writing outside image");
      }
      for (let y = 0; y < height; y++) {
        src.data.copy(
          dst.data,
          (deltaY + y) * dst.width + deltaX << 2,
          (srcY + y) * src.width + srcX << 2,
          (srcY + y) * src.width + srcX + width << 2
        );
      }
    };
    PNG2.prototype.bitblt = function(dst, srcX, srcY, width, height, deltaX, deltaY) {
      PNG2.bitblt(this, dst, srcX, srcY, width, height, deltaX, deltaY);
      return this;
    };
    PNG2.adjustGamma = function(src) {
      if (src.gamma) {
        for (let y = 0; y < src.height; y++) {
          for (let x2 = 0; x2 < src.width; x2++) {
            let idx = src.width * y + x2 << 2;
            for (let i2 = 0; i2 < 3; i2++) {
              let sample = src.data[idx + i2] / 255;
              sample = Math.pow(sample, 1 / 2.2 / src.gamma);
              src.data[idx + i2] = Math.round(sample * 255);
            }
          }
        }
        src.gamma = 0;
      }
    };
    PNG2.prototype.adjustGamma = function() {
      PNG2.adjustGamma(this);
    };
  }
});

// packages/mcbuilder/src/node/skill/main.ts
import { realpathSync } from "node:fs";
import * as nodeModule from "node:module";
import { homedir as homedir2 } from "node:os";
import { extname as extname6 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// packages/mcbuilder/src/errors.ts
var McbuilderError = class extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
};
var BuildError = class extends McbuilderError {
};
var GridBoundsError = class extends McbuilderError {
};

// packages/mcbuilder/src/node/cli.ts
import { mkdir as mkdir2, readFile as readFile2, stat as stat4, writeFile as writeFile2 } from "node:fs/promises";
import { homedir } from "node:os";
import { basename as basename2, dirname as dirname2, extname, join as join5, resolve as resolve3, sep as sep2 } from "node:path";
import { parseArgs } from "node:util";

// packages/core/src/blocks/pystr.ts
var PY_SPACE = /* @__PURE__ */ new Set([
  9,
  10,
  11,
  12,
  13,
  28,
  29,
  30,
  31,
  32,
  133,
  160,
  5760,
  8192,
  8193,
  8194,
  8195,
  8196,
  8197,
  8198,
  8199,
  8200,
  8201,
  8202,
  8232,
  8233,
  8239,
  8287,
  12288
]);
function isPySpace(ch) {
  const cp = ch.codePointAt(0);
  return cp !== void 0 && PY_SPACE.has(cp);
}
function pyStrip(s) {
  let start = 0;
  let end = s.length;
  while (start < end && PY_SPACE.has(s.charCodeAt(start))) start++;
  while (end > start && PY_SPACE.has(s.charCodeAt(end - 1))) end--;
  return s.slice(start, end);
}
function compareCodePoints(a, b) {
  const ia = a[Symbol.iterator]();
  const ib = b[Symbol.iterator]();
  for (; ; ) {
    const ra = ia.next();
    const rb = ib.next();
    if (ra.done && rb.done) return 0;
    if (ra.done) return -1;
    if (rb.done) return 1;
    const ca = ra.value.codePointAt(0);
    const cb = rb.value.codePointAt(0);
    if (ca !== cb) return ca < cb ? -1 : 1;
  }
}

// packages/core/src/blocks/difflib.ts
function longestMatch(a, b2j, alo, ahi, blo, bhi) {
  let besti = alo;
  let bestj = blo;
  let bestsize = 0;
  let j2len = /* @__PURE__ */ new Map();
  for (let i2 = alo; i2 < ahi; i2++) {
    const newj2len = /* @__PURE__ */ new Map();
    for (const j of b2j.get(a[i2]) ?? []) {
      if (j < blo) continue;
      if (j >= bhi) break;
      const k = (j2len.get(j - 1) ?? 0) + 1;
      newj2len.set(j, k);
      if (k > bestsize) {
        besti = i2 - k + 1;
        bestj = j - k + 1;
        bestsize = k;
      }
    }
    j2len = newj2len;
  }
  return [besti, bestj, bestsize];
}
function matchingBlocks(a, b) {
  const b2j = /* @__PURE__ */ new Map();
  b.forEach((ch, j) => {
    const arr = b2j.get(ch);
    if (arr) arr.push(j);
    else b2j.set(ch, [j]);
  });
  const found = [];
  const queue = [[0, a.length, 0, b.length]];
  while (queue.length > 0) {
    const [alo, ahi, blo, bhi] = queue.pop();
    const m = longestMatch(a, b2j, alo, ahi, blo, bhi);
    const [i2, j, k] = m;
    if (k > 0) {
      found.push(m);
      if (alo < i2 && blo < j) queue.push([alo, i2, blo, j]);
      if (i2 + k < ahi && j + k < bhi) queue.push([i2 + k, ahi, j + k, bhi]);
    }
  }
  return found;
}
function ratio(a, b) {
  const aa = Array.from(a);
  const bb = Array.from(b);
  const total2 = aa.length + bb.length;
  if (total2 === 0) return 1;
  let matches = 0;
  for (const [, , size] of matchingBlocks(aa, bb)) matches += size;
  return 2 * matches / total2;
}
function getCloseMatches(word, possibilities, n2 = 3, cutoff = 0.6) {
  const scored = [];
  for (const x2 of possibilities) {
    const score = ratio(x2, word);
    if (score >= cutoff) scored.push({ score, value: x2 });
  }
  scored.sort((p, q2) => q2.score - p.score || compareCodePoints(q2.value, p.value));
  return scored.slice(0, n2).map((s) => s.value);
}

// packages/core/src/blocks/blocks.ts
var BlockStringError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "BlockStringError";
  }
};
function repr(s) {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += `\\${ch}`;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "	") out += "\\t";
    else out += ch;
  }
  return quote + out + quote;
}
function parse(block) {
  if (typeof block !== "string" || block === "") {
    throw new BlockStringError(
      `malformed block string ${repr(String(block))}: must be a non-empty string`
    );
  }
  const brace = block.indexOf("{");
  const head = brace === -1 ? block : block.slice(0, brace);
  let nbt = null;
  if (brace !== -1) nbt = checkCompound(block.slice(brace));
  const bracket = head.indexOf("[");
  let name;
  let props;
  if (bracket === -1) {
    name = head;
    props = /* @__PURE__ */ new Map();
  } else {
    name = head.slice(0, bracket);
    const rest = head.slice(bracket);
    if (!rest.endsWith("]")) {
      throw new BlockStringError(`malformed block string ${repr(block)}: unclosed '['`);
    }
    props = parseProps(rest.slice(1, -1), block);
  }
  if (name === "") {
    throw new BlockStringError(`malformed block string ${repr(block)}: empty block name`);
  }
  for (const ch of name) {
    if ("[]{},".includes(ch) || isPySpace(ch)) {
      throw new BlockStringError(
        `malformed block string ${repr(block)}: bad block name ${repr(name)}`
      );
    }
  }
  return { name, props, nbt };
}
function canonicalize(block) {
  const { name, props, nbt } = parse(block);
  return join(name, props, nbt === null ? "" : canonicalizeNbt(nbt));
}
function join(name, props, suffix = "") {
  let out = name;
  if (props.size > 0) {
    const keys = [...props.keys()].sort(compareCodePoints);
    out += `[${keys.map((k) => `${k}=${props.get(k)}`).join(",")}]`;
  }
  return out + suffix;
}
function suggest(name, candidates, n2 = 3) {
  if (n2 <= 0) return [];
  const plain = stripNamespace(name);
  const table = /* @__PURE__ */ new Map();
  const plains = [];
  for (const cand of candidates) {
    const p = stripNamespace(cand);
    if (!table.has(p)) {
      table.set(p, cand);
      plains.push(p);
    }
  }
  return getCloseMatches(plain, plains, n2).map((p) => table.get(p));
}
function stripNamespace(s) {
  const i2 = s.indexOf(":");
  return i2 === -1 ? s : s.slice(i2 + 1);
}
function parseProps(inner, block) {
  if (inner === "") {
    throw new BlockStringError(`malformed block string ${repr(block)}: empty property list '[]'`);
  }
  const props = /* @__PURE__ */ new Map();
  for (const item of splitTopLevel(inner)) {
    const eq = item.indexOf("=");
    const key2 = pyStrip(eq === -1 ? item : item.slice(0, eq));
    const value = pyStrip(eq === -1 ? "" : item.slice(eq + 1));
    if (eq === -1 || key2 === "" || value === "") {
      throw new BlockStringError(
        `malformed block string ${repr(block)}: bad property ${repr(item)}`
      );
    }
    for (const ch of key2) {
      if (isPySpace(ch)) {
        throw new BlockStringError(
          `malformed block string ${repr(block)}: bad property key ${repr(key2)}`
        );
      }
    }
    if (props.has(key2)) {
      throw new BlockStringError(
        `malformed block string ${repr(block)}: duplicate property ${repr(key2)}`
      );
    }
    props.set(key2, value);
  }
  return props;
}
function checkCompound(raw) {
  let depthC = 0;
  let depthS = 0;
  let quote = null;
  let closedAt = null;
  const n2 = raw.length;
  let i2 = 0;
  while (i2 < n2) {
    const ch = raw[i2];
    if (quote !== null) {
      if (ch === "\\") {
        i2 += 2;
        continue;
      }
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === "{") {
      depthC++;
    } else if (ch === "}") {
      depthC--;
      if (depthC < 0) throw new BlockStringError(`malformed NBT ${repr(raw)}: unbalanced '}'`);
      if (depthC === 0 && closedAt === null) closedAt = i2;
    } else if (ch === "[") {
      depthS++;
    } else if (ch === "]") {
      depthS--;
      if (depthS < 0) throw new BlockStringError(`malformed NBT ${repr(raw)}: unbalanced ']'`);
    }
    i2++;
  }
  if (quote !== null) throw new BlockStringError(`malformed NBT ${repr(raw)}: unterminated string`);
  if (depthC !== 0 || depthS !== 0) {
    throw new BlockStringError(`malformed NBT ${repr(raw)}: unbalanced braces/brackets`);
  }
  if (closedAt !== n2 - 1) {
    throw new BlockStringError(`malformed NBT ${repr(raw)}: trailing characters after compound`);
  }
  return raw;
}
function canonicalizeNbt(raw) {
  const inner = raw.slice(1, -1);
  if (pyStrip(inner) === "") return "{}";
  const entries2 = [];
  for (const part of splitTopLevel(inner)) {
    if (pyStrip(part) === "") {
      throw new BlockStringError(`malformed NBT ${repr(raw)}: empty entry`);
    }
    const [key2, value] = splitKeyValue(part, raw);
    if (key2 === "") {
      throw new BlockStringError(`malformed NBT ${repr(raw)}: empty key in ${repr(part)}`);
    }
    entries2.push([key2, value]);
  }
  entries2.sort((a, b) => compareCodePoints(a[0], b[0]));
  return `{${entries2.map(([k, v]) => `${k}:${v}`).join(",")}}`;
}
function splitKeyValue(entry, raw) {
  let depthC = 0;
  let depthS = 0;
  let quote = null;
  const n2 = entry.length;
  let i2 = 0;
  while (i2 < n2) {
    const ch = entry[i2];
    if (quote !== null) {
      if (ch === "\\") {
        i2 += 2;
        continue;
      }
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === "{") {
      depthC++;
    } else if (ch === "}") {
      depthC--;
    } else if (ch === "[") {
      depthS++;
    } else if (ch === "]") {
      depthS--;
    } else if (ch === ":" && depthC === 0 && depthS === 0) {
      return [pyStrip(entry.slice(0, i2)), pyStrip(entry.slice(i2 + 1))];
    }
    i2++;
  }
  throw new BlockStringError(`malformed NBT ${repr(raw)}: entry without ':' — ${repr(entry)}`);
}
function splitTopLevel(s) {
  const parts = [];
  let depthC = 0;
  let depthS = 0;
  let quote = null;
  let cur = "";
  const n2 = s.length;
  let i2 = 0;
  while (i2 < n2) {
    const ch = s[i2];
    if (quote !== null) {
      cur += ch;
      if (ch === "\\" && i2 + 1 < n2) {
        cur += s[i2 + 1];
        i2 += 2;
        continue;
      }
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      cur += ch;
    } else if (ch === "{") {
      depthC++;
      cur += ch;
    } else if (ch === "}") {
      depthC--;
      cur += ch;
    } else if (ch === "[") {
      depthS++;
      cur += ch;
    } else if (ch === "]") {
      depthS--;
      cur += ch;
    } else if (ch === "," && depthC === 0 && depthS === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
    i2++;
  }
  parts.push(cur);
  return parts;
}

// packages/core/src/codecs/bedrock.ts
var COLORS = [
  "white",
  "orange",
  "magenta",
  "light_blue",
  "yellow",
  "lime",
  "pink",
  "gray",
  "light_gray",
  "cyan",
  "purple",
  "blue",
  "brown",
  "green",
  "red",
  "black"
];
var NAME_TO_JAVA = {
  web: "cobweb",
  reeds: "sugar_cane"
};
var NAME_TO_BEDROCK = Object.fromEntries(
  Object.entries(NAME_TO_JAVA).map(([b, j]) => [j, b])
);
var STAIR_DIR = ["east", "west", "south", "north"];
var BED_DIR = ["south", "west", "north", "east"];
var FACING_DIR = ["down", "up", "north", "south", "west", "east"];
var DOOR_TO_JAVA = {
  south: "east",
  west: "south",
  north: "west",
  east: "north"
};
var DOOR_TO_BEDROCK = Object.fromEntries(
  Object.entries(DOOR_TO_JAVA).map(([b, j]) => [j, b])
);
var SIDE_TO_JAVA = { none: "none", short: "low", tall: "tall" };
var SIDE_TO_BEDROCK = {
  none: "none",
  low: "short",
  tall: "tall"
};
var SHELF_CHAIN = ["unconnected", "right", "center", "left"];
var HORIZONTAL = /* @__PURE__ */ new Set(["north", "south", "east", "west"]);
var FACING_DIRECTION_BLOCKS = /^(barrel|hopper|dropper|dispenser|piston|sticky_piston|observer|ladder|.*_wall_sign|.*_wall_banner|.*_wall_hanging_sign)$/;
var bare = (id) => id.slice(id.indexOf(":") + 1);
var withNs = (n2) => n2.includes(":") ? n2 : `minecraft:${n2}`;
var stripNs = (k) => k.startsWith("minecraft:") ? k.slice("minecraft:".length) : k;
function bedrockToJava(bedrockName, statesIn, extra = {}) {
  const warnings = [];
  const s = /* @__PURE__ */ new Map();
  for (const [k, v] of statesIn) s.set(stripNs(k), v);
  const out = /* @__PURE__ */ new Map();
  const take = (key2) => {
    const v = s.get(key2);
    s.delete(key2);
    return v;
  };
  const bool = (v) => Number(v) ? "true" : "false";
  let name = bare(bedrockName);
  name = NAME_TO_JAVA[name] ?? name;
  if (name === "bed") {
    const color = extra.bedColor;
    if (color === void 0 || COLORS[color] === void 0) {
      warnings.push("bed without a readable colour became a white bed");
    }
    name = `${COLORS[color ?? 0] ?? "white"}_bed`;
    out.set("facing", BED_DIR[Number(take("direction"))] ?? "south");
    out.set("part", Number(take("head_piece_bit")) ? "head" : "foot");
    out.set("occupied", bool(take("occupied_bit")));
  } else if (name.endsWith("_stairs") && s.has("weirdo_direction")) {
    out.set("facing", STAIR_DIR[Number(take("weirdo_direction"))] ?? "east");
    out.set("half", Number(take("upside_down_bit")) ? "top" : "bottom");
    const corner = String(take("corner") ?? "none");
    out.set("shape", corner === "none" ? "straight" : corner);
  } else if (name.endsWith("_door") && s.has("upper_block_bit")) {
    out.set("facing", DOOR_TO_JAVA[String(take("cardinal_direction"))] ?? "north");
    out.set("half", Number(take("upper_block_bit")) ? "upper" : "lower");
    out.set("hinge", Number(take("door_hinge_bit")) ? "right" : "left");
    out.set("open", bool(take("open_bit")));
  } else if (name.endsWith("_double_slab")) {
    name = `${name.slice(0, -"_double_slab".length)}_slab`;
    out.set("type", "double");
    take("vertical_half");
  } else if (name.endsWith("_slab") && s.has("vertical_half")) {
    out.set("type", String(take("vertical_half")));
  } else if (name === "pale_moss_carpet") {
    for (const side of ["east", "north", "south", "west"]) {
      out.set(
        side,
        SIDE_TO_JAVA[String(take(`pale_moss_carpet_side_${side}`) ?? "none")] ?? "none"
      );
    }
    out.set("bottom", Number(take("upper_block_bit")) ? "false" : "true");
  } else if (name.endsWith("_shelf") && s.has("powered_shelf_type")) {
    out.set("facing", String(take("cardinal_direction")));
    out.set("powered", bool(take("powered_bit")));
    const chain = Number(take("powered_shelf_type"));
    out.set("side_chain", SHELF_CHAIN[chain] ?? "unconnected");
    if (chain !== 0) warnings.push(`${name}: side_chain value ${chain} is assumed, not verified`);
  }
  for (const side of ["north", "east", "south", "west"]) {
    if (s.has(`connection_${side}`)) out.set(side, bool(take(`connection_${side}`)));
    if (s.has(`wall_connection_type_${side}`)) {
      out.set(side, SIDE_TO_JAVA[String(take(`wall_connection_type_${side}`))] ?? "none");
    }
  }
  if (s.has("wall_post_bit")) out.set("up", bool(take("wall_post_bit")));
  if (s.has("pillar_axis")) out.set("axis", String(take("pillar_axis")));
  if (s.has("cardinal_direction")) out.set("facing", String(take("cardinal_direction")));
  if (s.has("facing_direction")) {
    out.set("facing", FACING_DIR[Number(take("facing_direction"))] ?? "north");
  }
  if (s.has("open_bit")) out.set("open", bool(take("open_bit")));
  if (s.has("powered_bit")) out.set("powered", bool(take("powered_bit")));
  if (s.has("button_pressed_bit")) out.set("powered", bool(take("button_pressed_bit")));
  if (s.has("in_wall_bit")) out.set("in_wall", bool(take("in_wall_bit")));
  for (const [k, v] of s) warnings.push(`${name}: dropped Bedrock state ${k}=${v}`);
  return { state: canonicalize(join(`minecraft:${name}`, out)), warnings };
}
var byte = (value) => ({ kind: "byte", value });
var int = (value) => ({ kind: "int", value });
var str = (value) => ({ kind: "string", value });
function javaToBedrock(canonical2) {
  const parse3 = parse(canonical2);
  const warnings = [];
  const p = new Map(parse3.props);
  const states = /* @__PURE__ */ new Map();
  const take = (key2) => {
    const v = p.get(key2);
    p.delete(key2);
    return v;
  };
  const flag = (v) => v === "true" ? 1 : 0;
  let name = bare(parse3.name);
  let bedColor;
  const waterlogged = take("waterlogged") === "true";
  if (name.endsWith("_bed")) {
    const color = COLORS.indexOf(name.slice(0, -"_bed".length));
    if (color === -1) warnings.push(`${name}: unknown bed colour`);
    bedColor = Math.max(color, 0);
    name = "bed";
    states.set(
      "direction",
      int(Math.max(BED_DIR.indexOf(take("facing") ?? "south"), 0))
    );
    states.set("head_piece_bit", byte(take("part") === "head" ? 1 : 0));
    states.set("occupied_bit", byte(flag(take("occupied"))));
  } else if (name.endsWith("_stairs")) {
    states.set(
      "weirdo_direction",
      int(Math.max(STAIR_DIR.indexOf(take("facing") ?? "east"), 0))
    );
    states.set("upside_down_bit", byte(take("half") === "top" ? 1 : 0));
    const shape = take("shape") ?? "straight";
    states.set("minecraft:corner", str(shape === "straight" ? "none" : shape));
  } else if (name.endsWith("_door") && p.has("half")) {
    states.set(
      "minecraft:cardinal_direction",
      str(DOOR_TO_BEDROCK[take("facing") ?? "north"] ?? "north")
    );
    states.set("upper_block_bit", byte(take("half") === "upper" ? 1 : 0));
    states.set("door_hinge_bit", byte(take("hinge") === "right" ? 1 : 0));
    states.set("open_bit", byte(flag(take("open"))));
    take("powered");
  } else if (name.endsWith("_slab") && p.has("type")) {
    const type = take("type");
    if (type === "double") {
      name = `${name.slice(0, -"_slab".length)}_double_slab`;
      states.set("minecraft:vertical_half", str("bottom"));
    } else {
      states.set("minecraft:vertical_half", str(type ?? "bottom"));
    }
  } else if (name === "pale_moss_carpet") {
    for (const side of ["east", "north", "south", "west"]) {
      states.set(
        `pale_moss_carpet_side_${side}`,
        str(SIDE_TO_BEDROCK[take(side) ?? "none"] ?? "none")
      );
    }
    states.set("upper_block_bit", byte(take("bottom") === "false" ? 1 : 0));
  } else if (name.endsWith("_shelf") && p.has("side_chain")) {
    states.set("minecraft:cardinal_direction", str(take("facing") ?? "north"));
    states.set("powered_bit", byte(flag(take("powered"))));
    states.set(
      "powered_shelf_type",
      int(
        Math.max(
          SHELF_CHAIN.indexOf(
            take("side_chain") ?? "unconnected"
          ),
          0
        )
      )
    );
  }
  const isWall = name.endsWith("_wall");
  for (const side of ["north", "east", "south", "west"]) {
    const v = p.get(side);
    if (v === void 0) continue;
    p.delete(side);
    if (isWall) states.set(`wall_connection_type_${side}`, str(SIDE_TO_BEDROCK[v] ?? "none"));
    else states.set(`minecraft:connection_${side}`, int(flag(v)));
  }
  if (isWall && p.has("up")) states.set("wall_post_bit", byte(flag(take("up"))));
  const axis = take("axis");
  if (axis !== void 0) states.set("pillar_axis", str(axis));
  const facing = take("facing");
  if (facing !== void 0) {
    if (FACING_DIRECTION_BLOCKS.test(name)) {
      const i2 = FACING_DIR.indexOf(facing);
      states.set("facing_direction", int(i2 === -1 ? 0 : i2));
    } else if (HORIZONTAL.has(facing)) {
      states.set("minecraft:cardinal_direction", str(facing));
    } else {
      warnings.push(`${name}: facing=${facing} has no Bedrock cardinal_direction`);
    }
  }
  const open = take("open");
  if (open !== void 0) states.set("open_bit", byte(flag(open)));
  const powered = take("powered");
  if (powered !== void 0 && !name.endsWith("_door"))
    states.set("powered_bit", byte(flag(powered)));
  const inWall = take("in_wall");
  if (inWall !== void 0) states.set("in_wall_bit", byte(flag(inWall)));
  const DEFAULTS = /* @__PURE__ */ new Map([
    ["lit", "false"],
    ["type", "single"],
    ["powered", "false"],
    ["side_chain", "unconnected"]
  ]);
  for (const [k, v] of p) {
    if (DEFAULTS.get(k) !== v)
      warnings.push(`${bare(parse3.name)}: dropped Java property ${k}=${v}`);
  }
  return {
    block: { name: withNs(NAME_TO_BEDROCK[name] ?? name), states },
    bedColor,
    waterlogged,
    warnings
  };
}

// packages/core/src/nbt/types.ts
var TagId = {
  End: 0,
  Byte: 1,
  Short: 2,
  Int: 3,
  Long: 4,
  Float: 5,
  Double: 6,
  ByteArray: 7,
  String: 8,
  List: 9,
  Compound: 10,
  IntArray: 11,
  LongArray: 12
};
var NbtError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "NbtError";
  }
};
var TYPE_TO_ID = {
  byte: TagId.Byte,
  short: TagId.Short,
  int: TagId.Int,
  long: TagId.Long,
  float: TagId.Float,
  double: TagId.Double,
  byteArray: TagId.ByteArray,
  string: TagId.String,
  list: TagId.List,
  compound: TagId.Compound,
  intArray: TagId.IntArray,
  longArray: TagId.LongArray
};
function tagId(tag) {
  return TYPE_TO_ID[tag.type];
}
var byte2 = (value) => ({ type: "byte", value });
var short = (value) => ({ type: "short", value });
var int2 = (value) => ({ type: "int", value });
var long = (value) => ({ type: "long", value });
var float = (value) => ({ type: "float", value });
var double = (value) => ({ type: "double", value });
var string = (value) => ({ type: "string", value });
var byteArray = (value) => ({ type: "byteArray", value });
var intArray = (value) => ({ type: "intArray", value });
var longArray = (value) => ({ type: "longArray", value });
function list(elementType, value) {
  return { type: "list", elementType, value };
}
function compound(entries2 = []) {
  return { type: "compound", value: new Map(entries2) };
}

// packages/core/src/nbt/mutf8.ts
function encodeMutf8(s) {
  const out = [];
  for (let i2 = 0; i2 < s.length; i2++) {
    const c = s.charCodeAt(i2);
    if (c !== 0 && c < 128) {
      out.push(c);
    } else if (c < 2048) {
      out.push(192 | c >> 6, 128 | c & 63);
    } else {
      out.push(224 | c >> 12, 128 | c >> 6 & 63, 128 | c & 63);
    }
  }
  return Uint8Array.from(out);
}
function decodeMutf8(bytes) {
  const units = [];
  let i2 = 0;
  const cont = (k) => {
    const b = bytes[k];
    if (b === void 0 || (b & 192) !== 128) {
      throw new NbtError("invalid modified UTF-8 sequence");
    }
    return b & 63;
  };
  while (i2 < bytes.length) {
    const b = bytes[i2];
    if (b < 128) {
      units.push(b);
      i2 += 1;
    } else if ((b & 224) === 192) {
      units.push((b & 31) << 6 | cont(i2 + 1));
      i2 += 2;
    } else if ((b & 240) === 224) {
      units.push((b & 15) << 12 | cont(i2 + 1) << 6 | cont(i2 + 2));
      i2 += 3;
    } else if ((b & 248) === 240) {
      const cp = (b & 7) << 18 | cont(i2 + 1) << 12 | cont(i2 + 2) << 6 | cont(i2 + 3);
      if (cp < 65536 || cp > 1114111) throw new NbtError("invalid modified UTF-8 sequence");
      const v = cp - 65536;
      units.push(55296 | v >> 10, 56320 | v & 1023);
      i2 += 4;
    } else {
      throw new NbtError("invalid modified UTF-8 sequence");
    }
  }
  const CHUNK = 8192;
  let s = "";
  for (let k = 0; k < units.length; k += CHUNK) {
    s += String.fromCharCode(...units.slice(k, k + CHUNK));
  }
  return s;
}

// packages/core/src/nbt/reader.ts
var MAX_DEPTH = 512;
var Cursor = class {
  view;
  bytes;
  little;
  pos = 0;
  constructor(bytes, little) {
    this.bytes = bytes;
    this.little = little;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  need(n2) {
    if (n2 < 0 || this.pos + n2 > this.bytes.length) {
      throw new NbtError("unexpected end of NBT data");
    }
  }
  u8() {
    this.need(1);
    return this.view.getUint8(this.pos++);
  }
  i8() {
    this.need(1);
    return this.view.getInt8(this.pos++);
  }
  i16() {
    this.need(2);
    const v = this.view.getInt16(this.pos, this.little);
    this.pos += 2;
    return v;
  }
  u16() {
    this.need(2);
    const v = this.view.getUint16(this.pos, this.little);
    this.pos += 2;
    return v;
  }
  i32() {
    this.need(4);
    const v = this.view.getInt32(this.pos, this.little);
    this.pos += 4;
    return v;
  }
  i64() {
    this.need(8);
    const v = this.view.getBigInt64(this.pos, this.little);
    this.pos += 8;
    return v;
  }
  f32() {
    this.need(4);
    const v = this.view.getFloat32(this.pos, this.little);
    this.pos += 4;
    return v;
  }
  f64() {
    this.need(8);
    const v = this.view.getFloat64(this.pos, this.little);
    this.pos += 8;
    return v;
  }
  take(n2) {
    this.need(n2);
    const out = this.bytes.subarray(this.pos, this.pos + n2);
    this.pos += n2;
    return out;
  }
  str() {
    return decodeMutf8(this.take(this.u16()));
  }
  length() {
    const n2 = this.i32();
    if (n2 < 0) throw new NbtError(`negative array length ${n2}`);
    return n2;
  }
};
function readPayload(c, id, depth) {
  if (depth > MAX_DEPTH) throw new NbtError("NBT nesting too deep");
  switch (id) {
    case TagId.Byte:
      return { type: "byte", value: c.i8() };
    case TagId.Short:
      return { type: "short", value: c.i16() };
    case TagId.Int:
      return { type: "int", value: c.i32() };
    case TagId.Long:
      return { type: "long", value: c.i64() };
    case TagId.Float:
      return { type: "float", value: c.f32() };
    case TagId.Double:
      return { type: "double", value: c.f64() };
    case TagId.ByteArray: {
      const n2 = c.length();
      const raw = c.take(n2);
      return { type: "byteArray", value: new Int8Array(raw.slice().buffer) };
    }
    case TagId.String:
      return { type: "string", value: c.str() };
    case TagId.List: {
      const elementType = c.u8();
      const n2 = c.length();
      if (!isTagId(elementType)) throw new NbtError(`unknown list element type ${elementType}`);
      if (elementType === TagId.End && n2 > 0) {
        throw new NbtError("non-empty list of TAG_End");
      }
      const value = [];
      for (let i2 = 0; i2 < n2; i2++) value.push(readPayload(c, elementType, depth + 1));
      return { type: "list", elementType, value };
    }
    case TagId.Compound: {
      const value = /* @__PURE__ */ new Map();
      for (; ; ) {
        const childId = c.u8();
        if (childId === TagId.End) break;
        if (!isTagId(childId)) throw new NbtError(`unknown tag type ${childId}`);
        const name = c.str();
        value.set(name, readPayload(c, childId, depth + 1));
      }
      return { type: "compound", value };
    }
    case TagId.IntArray: {
      const n2 = c.length();
      c.need(n2 * 4);
      const out = new Int32Array(n2);
      for (let i2 = 0; i2 < n2; i2++) out[i2] = c.i32();
      return { type: "intArray", value: out };
    }
    case TagId.LongArray: {
      const n2 = c.length();
      c.need(n2 * 8);
      const out = new BigInt64Array(n2);
      for (let i2 = 0; i2 < n2; i2++) out[i2] = c.i64();
      return { type: "longArray", value: out };
    }
    default:
      throw new NbtError(`unknown tag type ${id}`);
  }
}
function isTagId(n2) {
  return Number.isInteger(n2) && n2 >= 0 && n2 <= TagId.LongArray;
}
function readNbt(bytes, options = {}) {
  const c = new Cursor(bytes, options.endian === "little");
  const id = c.u8();
  if (id !== TagId.Compound) {
    throw new NbtError(`root tag must be a compound, found type ${id}`);
  }
  const name = c.str();
  const tag = readPayload(c, TagId.Compound, 0);
  return { name, tag };
}

// packages/core/src/nbt/writer.ts
var Sink = class {
  buf = new Uint8Array(256);
  view = new DataView(this.buf.buffer);
  len = 0;
  little;
  constructor(little) {
    this.little = little;
  }
  grow(n2) {
    if (this.len + n2 <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + n2) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
    this.view = new DataView(next.buffer);
  }
  u8(v) {
    this.grow(1);
    this.view.setUint8(this.len++, v);
  }
  i8(v) {
    this.grow(1);
    this.view.setInt8(this.len++, v);
  }
  i16(v) {
    this.grow(2);
    this.view.setInt16(this.len, v, this.little);
    this.len += 2;
  }
  u16(v) {
    this.grow(2);
    this.view.setUint16(this.len, v, this.little);
    this.len += 2;
  }
  i32(v) {
    this.grow(4);
    this.view.setInt32(this.len, v, this.little);
    this.len += 4;
  }
  i64(v) {
    this.grow(8);
    this.view.setBigInt64(this.len, v, this.little);
    this.len += 8;
  }
  f32(v) {
    this.grow(4);
    this.view.setFloat32(this.len, v, this.little);
    this.len += 4;
  }
  f64(v) {
    this.grow(8);
    this.view.setFloat64(this.len, v, this.little);
    this.len += 8;
  }
  raw(b) {
    this.grow(b.length);
    this.buf.set(b, this.len);
    this.len += b.length;
  }
  str(s) {
    const b = encodeMutf8(s);
    if (b.length > 65535) throw new NbtError("string too long for NBT");
    this.u16(b.length);
    this.raw(b);
  }
  bytes() {
    return this.buf.slice(0, this.len);
  }
};
function writePayload(s, tag) {
  switch (tag.type) {
    case "byte":
      s.i8(tag.value);
      return;
    case "short":
      s.i16(tag.value);
      return;
    case "int":
      s.i32(tag.value);
      return;
    case "long":
      s.i64(tag.value);
      return;
    case "float":
      s.f32(tag.value);
      return;
    case "double":
      s.f64(tag.value);
      return;
    case "byteArray":
      s.i32(tag.value.length);
      s.raw(new Uint8Array(tag.value.buffer, tag.value.byteOffset, tag.value.byteLength));
      return;
    case "string":
      s.str(tag.value);
      return;
    case "list":
      s.u8(tag.elementType);
      s.i32(tag.value.length);
      for (const el of tag.value) {
        if (tagId(el) !== tag.elementType) {
          throw new NbtError(`list of type ${tag.elementType} holds a ${el.type} tag`);
        }
        writePayload(s, el);
      }
      return;
    case "compound":
      for (const [name, child2] of tag.value) {
        s.u8(tagId(child2));
        s.str(name);
        writePayload(s, child2);
      }
      s.u8(TagId.End);
      return;
    case "intArray":
      s.i32(tag.value.length);
      for (const v of tag.value) s.i32(v);
      return;
    case "longArray":
      s.i32(tag.value.length);
      for (const v of tag.value) s.i64(v);
      return;
  }
}
function writeNbt(root, options = {}) {
  const s = new Sink(options.endian === "little");
  s.u8(TagId.Compound);
  s.str(root.name);
  writePayload(s, root.tag);
  return s.bytes();
}

// packages/core/src/nbt/gzip.ts
async function pipe(bytes, stream) {
  const source = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
  const out = source.pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}
function isGzip(bytes) {
  return bytes.length >= 2 && bytes[0] === 31 && bytes[1] === 139;
}
function gzip(bytes) {
  return pipe(bytes, new CompressionStream("gzip"));
}
function gunzip(bytes) {
  return pipe(bytes, new DecompressionStream("gzip"));
}
async function readNbtFile(bytes, options = {}) {
  return readNbt(isGzip(bytes) ? await gunzip(bytes) : bytes, options);
}
async function writeNbtGzip(root, options = {}) {
  return gzip(writeNbt(root, options));
}

// packages/core/src/nbt/util.ts
function cloneNbt(tag) {
  switch (tag.type) {
    case "byteArray":
      return { type: "byteArray", value: tag.value.slice() };
    case "intArray":
      return { type: "intArray", value: tag.value.slice() };
    case "longArray":
      return { type: "longArray", value: tag.value.slice() };
    case "list":
      return {
        type: "list",
        elementType: tag.elementType,
        value: tag.value.map((v) => cloneNbt(v))
      };
    case "compound": {
      const value = /* @__PURE__ */ new Map();
      for (const [k, v] of tag.value) value.set(k, cloneNbt(v));
      return { type: "compound", value };
    }
    default:
      return { ...tag };
  }
}
function nbtEqual(a, b) {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case "byte":
    case "short":
    case "int":
    case "float":
    case "double":
      return Object.is(a.value, b.value);
    case "long":
    case "string":
      return a.value === b.value;
    case "byteArray":
    case "intArray":
    case "longArray": {
      const bv = b.value;
      const av = a.value;
      if (av.length !== bv.length) return false;
      for (let i2 = 0; i2 < av.length; i2++) if (av[i2] !== bv[i2]) return false;
      return true;
    }
    case "list": {
      const other = b;
      if (a.value.length !== other.value.length) return false;
      if (a.value.length > 0 && a.elementType !== other.elementType) return false;
      return a.value.every((v, i2) => nbtEqual(v, other.value[i2]));
    }
    case "compound": {
      const other = b.value;
      if (a.value.size !== other.size) return false;
      for (const [k, v] of a.value) {
        const w = other.get(k);
        if (w === void 0 || !nbtEqual(v, w)) return false;
      }
      return true;
    }
  }
}

// packages/core/src/volume/entity.ts
function blockIdOf(block) {
  const a = block.indexOf("[");
  const b = block.indexOf("{");
  const end = a === -1 ? b : b === -1 ? a : Math.min(a, b);
  return end === -1 ? block : block.slice(0, end);
}
function entityPosition(nbt) {
  const pos = nbt.value.get("Pos");
  if (pos?.type !== "list" || pos.value.length !== 3) return void 0;
  const out = [];
  for (const v of pos.value) {
    if (v.type !== "double" && v.type !== "float") return void 0;
    out.push(v.value);
  }
  return out;
}
function positionTag(edition, x2, y, z) {
  const num = (v) => edition === "java" ? { type: "double", value: v } : { type: "float", value: Math.fround(v) };
  return {
    type: "list",
    elementType: edition === "java" ? TagId.Double : TagId.Float,
    value: [num(x2), num(y), num(z)]
  };
}
function shiftEntity(e, dx, dy, dz) {
  const pos = e.nbt.value.get("Pos");
  if (pos?.type !== "list" || pos.value.length !== 3 || dx === 0 && dy === 0 && dz === 0) {
    return e;
  }
  const d = [dx, dy, dz];
  const moved = pos.value.map((v, i2) => {
    const delta = d[i2];
    if (v.type === "double") return { type: "double", value: v.value + delta };
    if (v.type === "float") return { type: "float", value: Math.fround(v.value + delta) };
    return v;
  });
  const value = new Map(e.nbt.value);
  value.set("Pos", { type: "list", elementType: pos.elementType, value: moved });
  return { edition: e.edition, nbt: { type: "compound", value } };
}

// packages/core/src/volume/volume.ts
var AIR = "minecraft:air";
var MAX_EXTENT = 512;
var UNSET = -1;
var SECTION_BITS = 4;
var SECTION_SIZE = 1 << SECTION_BITS;
var SECTION_MASK = SECTION_SIZE - 1;
var SECTION_VOLUME = SECTION_SIZE ** 3;
var Section = class {
  data = new Int32Array(SECTION_VOLUME).fill(UNSET);
  count = 0;
};
var VolumeError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "VolumeError";
  }
};
function checkCoord(axis, v) {
  if (!Number.isSafeInteger(v) || Math.abs(v) > 2147483647) {
    throw new VolumeError(`axis ${axis}: coordinate ${v} is not a 32-bit integer`);
  }
}
var sectionKey = (sx, sy, sz) => `${sx},${sy},${sz}`;
var cellIndex = (x2, y, z) => (y & SECTION_MASK) << 8 | (z & SECTION_MASK) << 4 | x2 & SECTION_MASK;
var blockEntityKey = (x2, y, z) => `${x2},${y},${z}`;
function parseBlockEntityKey(key2) {
  const p = key2.split(",").map(Number);
  return [p[0], p[1], p[2]];
}
var Volume = class {
  sections = /* @__PURE__ */ new Map();
  paletteList = [];
  paletteIndex = /* @__PURE__ */ new Map();
  cellCount = 0;
  // Cached bounding box of the set cells (air included). Exact whenever
  // `boundsStale` is false and cellCount > 0. A set that adds a cell widens
  // it; an unset of a cell on one of its faces may shrink it, so that marks
  // it stale and the next placedBounds() rescans. Every path that changes
  // which cells are set goes through put(), unset() or translate().
  minX = 0;
  minY = 0;
  minZ = 0;
  maxX = 0;
  maxY = 0;
  maxZ = 0;
  boundsStale = false;
  blockEntityMap = /* @__PURE__ */ new Map();
  entityList = [];
  /** The interned palette, in the order blocks were first set. */
  get palette() {
    return this.paletteList;
  }
  /** Number of cells that have been set, air included. */
  get size() {
    return this.cellCount;
  }
  /** Block entities by cell, keyed `"x,y,z"`. Do not modify the map; use the methods. */
  get blockEntities() {
    return this.blockEntityMap;
  }
  /** Number of block entities held. */
  get blockEntityCount() {
    return this.blockEntityMap.size;
  }
  /** Entities, in the order they were added. */
  get entities() {
    return this.entityList;
  }
  /** The block entity at a cell, if any. */
  blockEntityAt(x2, y, z) {
    if (this.blockEntityMap.size === 0) return void 0;
    return this.blockEntityMap.get(blockEntityKey(x2, y, z));
  }
  /**
   * Attach a block entity to a cell, replacing any it had. The cell must hold
   * a block (set it first).
   */
  setBlockEntity(x2, y, z, entity) {
    if (this.indexAt(x2, y, z) === UNSET) {
      throw new VolumeError(`cannot attach a block entity to unset cell ${x2},${y},${z}`);
    }
    this.blockEntityMap.set(blockEntityKey(x2, y, z), entity);
  }
  /** Remove the block entity at a cell. Returns whether there was one. */
  deleteBlockEntity(x2, y, z) {
    if (this.blockEntityMap.size === 0) return false;
    return this.blockEntityMap.delete(blockEntityKey(x2, y, z));
  }
  /** Visit every block entity with its cell. */
  eachBlockEntity(fn) {
    for (const [key2, entity] of this.blockEntityMap) {
      const [x2, y, z] = parseBlockEntityKey(key2);
      fn(x2, y, z, entity);
    }
  }
  /** Add an entity. Its `Pos` is in volume coordinates. */
  addEntity(entity) {
    this.entityList.push(entity);
  }
  /** Replace the whole entity list. */
  setEntities(entities) {
    this.entityList = [...entities];
  }
  /** Add `block` to the palette if needed and return its index. */
  intern(block) {
    let idx = this.paletteIndex.get(block);
    if (idx === void 0) {
      idx = this.paletteList.length;
      this.paletteList.push(block);
      this.paletteIndex.set(block, idx);
    }
    return idx;
  }
  /** Set a cell. The last write wins. `block` should be a canonical block string. */
  set(x2, y, z, block) {
    checkCoord("x", x2);
    checkCoord("y", y);
    checkCoord("z", z);
    this.put(x2, y, z, this.intern(block));
  }
  /**
   * Set a cell by palette index, or make it unset with {@link UNSET}. The
   * index must come from this volume's palette (it never shrinks, so an
   * index stays valid for the life of the volume).
   */
  setIndex(x2, y, z, index) {
    if (index === UNSET) {
      this.unset(x2, y, z);
      return;
    }
    if (!Number.isInteger(index) || index < 0 || index >= this.paletteList.length) {
      throw new VolumeError(`palette index ${index} is out of range`);
    }
    checkCoord("x", x2);
    checkCoord("y", y);
    checkCoord("z", z);
    this.put(x2, y, z, index);
  }
  put(x2, y, z, idx) {
    const sx = x2 >> SECTION_BITS;
    const sy = y >> SECTION_BITS;
    const sz = z >> SECTION_BITS;
    const key2 = sectionKey(sx, sy, sz);
    let entry = this.sections.get(key2);
    if (entry === void 0) {
      entry = { sx, sy, sz, s: new Section() };
      this.sections.set(key2, entry);
    }
    const i2 = cellIndex(x2, y, z);
    const prev = entry.s.data[i2];
    if (prev === UNSET) {
      if (this.cellCount === 0) {
        this.minX = this.maxX = x2;
        this.minY = this.maxY = y;
        this.minZ = this.maxZ = z;
        this.boundsStale = false;
      } else if (!this.boundsStale) {
        if (x2 < this.minX) this.minX = x2;
        else if (x2 > this.maxX) this.maxX = x2;
        if (y < this.minY) this.minY = y;
        else if (y > this.maxY) this.maxY = y;
        if (z < this.minZ) this.minZ = z;
        else if (z > this.maxZ) this.maxZ = z;
      }
      entry.s.count++;
      this.cellCount++;
    } else if (prev !== idx && this.blockEntityMap.size > 0) {
      const key3 = blockEntityKey(x2, y, z);
      if (this.blockEntityMap.has(key3) && blockIdOf(this.paletteList[prev]) !== blockIdOf(this.paletteList[idx])) {
        this.blockEntityMap.delete(key3);
      }
    }
    entry.s.data[i2] = idx;
  }
  /** Make a cell unset again. Returns whether it held a value. */
  unset(x2, y, z) {
    const entry = this.sections.get(
      sectionKey(x2 >> SECTION_BITS, y >> SECTION_BITS, z >> SECTION_BITS)
    );
    if (entry === void 0) return false;
    const i2 = cellIndex(x2, y, z);
    if (entry.s.data[i2] === UNSET) return false;
    entry.s.data[i2] = UNSET;
    entry.s.count--;
    this.cellCount--;
    if (this.cellCount === 0) {
      this.boundsStale = false;
    } else if (!this.boundsStale && (x2 === this.minX || x2 === this.maxX || y === this.minY || y === this.maxY || z === this.minZ || z === this.maxZ)) {
      this.boundsStale = true;
    }
    if (this.blockEntityMap.size > 0) this.blockEntityMap.delete(blockEntityKey(x2, y, z));
    return true;
  }
  /**
   * Move every set cell, block entity and entity by `(dx, dy, dz)` in place.
   * The palette is kept.
   */
  translate(dx, dy, dz) {
    if (dx === 0 && dy === 0 && dz === 0) return;
    const cells = [];
    this.eachCell((x2, y, z, idx) => {
      cells.push([x2 + dx, y + dy, z + dz, idx]);
    });
    const entities = [];
    this.eachBlockEntity((x2, y, z, e) => {
      entities.push([x2 + dx, y + dy, z + dz, e]);
    });
    this.sections.clear();
    this.blockEntityMap.clear();
    this.cellCount = 0;
    this.boundsStale = false;
    for (const [x2, y, z, idx] of cells) this.set(x2, y, z, this.paletteList[idx]);
    for (const [x2, y, z, e] of entities) this.blockEntityMap.set(blockEntityKey(x2, y, z), e);
    this.entityList = this.entityList.map((e) => shiftEntity(e, dx, dy, dz));
  }
  /** Palette index at a cell, or {@link UNSET}. */
  indexAt(x2, y, z) {
    const entry = this.sections.get(
      sectionKey(x2 >> SECTION_BITS, y >> SECTION_BITS, z >> SECTION_BITS)
    );
    return entry === void 0 ? UNSET : entry.s.data[cellIndex(x2, y, z)];
  }
  /** Block string at a cell, or `undefined` when it was never set. */
  get(x2, y, z) {
    const idx = this.indexAt(x2, y, z);
    return idx === UNSET ? void 0 : this.paletteList[idx];
  }
  /** Visit every set cell. Order is by section, not by coordinate. */
  eachCell(fn) {
    for (const { sx, sy, sz, s } of this.sections.values()) {
      if (s.count === 0) continue;
      for (let i2 = 0; i2 < SECTION_VOLUME; i2++) {
        const idx = s.data[i2];
        if (idx === UNSET) continue;
        fn(
          sx << SECTION_BITS | i2 & SECTION_MASK,
          sy << SECTION_BITS | i2 >> 8,
          sz << SECTION_BITS | i2 >> 4 & SECTION_MASK,
          idx
        );
      }
    }
  }
  boundsWhere(include) {
    let min = null;
    let max2 = null;
    this.eachCell((x2, y, z, idx) => {
      if (!include(idx)) return;
      if (min === null || max2 === null) {
        min = [x2, y, z];
        max2 = [x2, y, z];
        return;
      }
      if (x2 < min[0]) min[0] = x2;
      if (y < min[1]) min[1] = y;
      if (z < min[2]) min[2] = z;
      if (x2 > max2[0]) max2[0] = x2;
      if (y > max2[1]) max2[1] = y;
      if (z > max2[2]) max2[2] = z;
    });
    return min === null || max2 === null ? null : [min, max2];
  }
  /** Inclusive bounding box over every set cell, air included, or `null` when empty. */
  placedBounds() {
    if (this.cellCount === 0) return null;
    if (this.boundsStale) {
      const b = this.boundsWhere(() => true);
      if (b === null) return null;
      [this.minX, this.minY, this.minZ] = b[0];
      [this.maxX, this.maxY, this.maxZ] = b[1];
      this.boundsStale = false;
    }
    return [
      [this.minX, this.minY, this.minZ],
      [this.maxX, this.maxY, this.maxZ]
    ];
  }
  /** Inclusive bounding box over non-air cells, or `null` when there are none. */
  bounds() {
    return this.boundsWhere((idx) => this.paletteList[idx] !== AIR);
  }
  /** Number of set cells whose block is not `minecraft:air`. */
  countNonAir() {
    let n2 = 0;
    this.eachCell((_x, _y, _z, idx) => {
      if (this.paletteList[idx] !== AIR) n2++;
    });
    return n2;
  }
  /**
   * Materialize the placed region (see {@link placedBounds}) as a dense
   * array. The palette is compacted to the entries some cell references, in
   * their original order. An empty volume gives a 0x0x0 array.
   */
  toDense() {
    const bb = this.placedBounds();
    if (bb === null) {
      return { size: [0, 0, 0], origin: [0, 0, 0], data: new Int32Array(0), palette: [] };
    }
    const [min, max2] = bb;
    const sx = max2[0] - min[0] + 1;
    const sy = max2[1] - min[1] + 1;
    const sz = max2[2] - min[2] + 1;
    const total2 = sx * sy * sz;
    if (total2 > 2147483647)
      throw new VolumeError(`volume ${sx}x${sy}x${sz} is too large to densify`);
    const data = new Int32Array(total2).fill(UNSET);
    const used = new Uint8Array(this.paletteList.length);
    this.eachCell((x2, y, z, idx) => {
      data[((x2 - min[0]) * sy + (y - min[1])) * sz + (z - min[2])] = idx;
      used[idx] = 1;
    });
    const remap2 = new Int32Array(this.paletteList.length).fill(UNSET);
    const palette = [];
    for (let i2 = 0; i2 < used.length; i2++) {
      if (used[i2]) {
        remap2[i2] = palette.length;
        palette.push(this.paletteList[i2]);
      }
    }
    if (palette.length !== this.paletteList.length) {
      for (let i2 = 0; i2 < data.length; i2++) {
        const v = data[i2];
        if (v !== UNSET) data[i2] = remap2[v];
      }
    }
    return { size: [sx, sy, sz], origin: min, data, palette };
  }
};

// packages/core/src/codecs/common.ts
var CodecError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "CodecError";
  }
};
var AIR_BLOCKS = /* @__PURE__ */ new Set([
  "minecraft:air",
  "minecraft:cave_air",
  "minecraft:void_air"
]);
var SKIP_BLOCKS = /* @__PURE__ */ new Set([
  "minecraft:structure_void",
  "minecraft:structure_block",
  "minecraft:jigsaw"
]);
function checkExtent(size, options) {
  const limit = options.maxExtent ?? MAX_EXTENT;
  if (size.some((n2) => n2 > limit)) {
    throw new CodecError(
      `this build is ${size[0]} x ${size[1]} x ${size[2]}; the limit is ${limit} blocks per axis`
    );
  }
}
function child(tag, name) {
  return tag.value.get(name);
}
function asCompound(tag, what) {
  if (tag?.type !== "compound") throw new CodecError(`${what} must be a compound`);
  return tag;
}
function asNumber(tag, what) {
  if (tag === void 0) throw new CodecError(`${what} is missing`);
  if (tag.type === "byte" || tag.type === "short" || tag.type === "int") return tag.value;
  throw new CodecError(`${what} must be an integer tag, found ${tag.type}`);
}

// packages/core/src/codecs/carry.ts
var POSITION_KEYS = /* @__PURE__ */ new Set(["x", "y", "z"]);
function entriesWithout(tag, skip) {
  return [...tag.value].filter(([k]) => !skip.has(k));
}
function kindOf(tag) {
  if (tag?.type !== "string" || tag.value === "") return "unknown";
  return tag.value.startsWith("minecraft:") ? tag.value.slice(10) : tag.value;
}
var Tally = class {
  blocks = /* @__PURE__ */ new Map();
  mobs = /* @__PURE__ */ new Map();
  addBlockEntity(kind) {
    this.blocks.set(kind, (this.blocks.get(kind) ?? 0) + 1);
  }
  addEntity(kind) {
    this.mobs.set(kind, (this.mobs.get(kind) ?? 0) + 1);
  }
  get blockEntityCount() {
    let n2 = 0;
    for (const c of this.blocks.values()) n2 += c;
    return n2;
  }
  get entityCount() {
    let n2 = 0;
    for (const c of this.mobs.values()) n2 += c;
    return n2;
  }
  /** One line per non-empty count, such as `2 block entities not carried over (why): chest x2`. */
  lines(why) {
    const out = [];
    const describe = (counts, one, many) => {
      let total2 = 0;
      for (const c of counts.values()) total2 += c;
      if (total2 === 0) return;
      const kinds = [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([k, c]) => `${k} x${c}`).join(", ");
      out.push(`${total2} ${total2 === 1 ? one : many} not carried over (${why}): ${kinds}`);
    };
    describe(this.blocks, "block entity", "block entities");
    describe(this.mobs, "entity", "entities");
    return out;
  }
};
var bareName = (name) => name.startsWith("minecraft:") ? name.slice(10) : name;
function describeCounts(counts) {
  return [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([k, c]) => `${k} x${c}`).join(", ");
}
function classifyBlock(name) {
  if (SKIP_BLOCKS.has(name)) return "skip";
  return AIR_BLOCKS.has(name) ? "air" : "block";
}
var BlockTally = class {
  skipped = /* @__PURE__ */ new Map();
  air = /* @__PURE__ */ new Map();
  /**
   * Classify a block read from a file by its name (no properties) and count
   * it if it is dropped or rewritten. Nothing is counted for plain
   * `minecraft:air`.
   */
  note(name) {
    const kind = classifyBlock(name);
    const bare2 = bareName(name);
    if (kind === "skip") this.skipped.set(bare2, (this.skipped.get(bare2) ?? 0) + 1);
    else if (kind === "air" && name !== "minecraft:air") {
      this.air.set(bare2, (this.air.get(bare2) ?? 0) + 1);
    }
    return kind;
  }
  /** One line per non-empty count. */
  lines() {
    const out = [];
    const describe = (counts, why, verb) => {
      let total2 = 0;
      for (const c of counts.values()) total2 += c;
      if (total2 === 0) return;
      out.push(
        `${total2} ${total2 === 1 ? "block" : "blocks"} ${verb} (${why}): ${describeCounts(counts)}`
      );
    };
    describe(this.skipped, "editor leftovers that are not part of a build", "not carried over");
    describe(this.air, "cave_air and void_air are not kept", "turned into air");
    return out;
  }
};
function attachBlockEntity(volume, x2, y, z, entity, lost, kind) {
  if (volume.indexAt(x2, y, z) < 0) lost.addBlockEntity(kind);
  else volume.setBlockEntity(x2, y, z, entity);
}
var blockEntityKind = (e) => kindOf(e.nbt.value.get("id"));
var entityKind = (e) => kindOf(e.nbt.value.get(e.edition === "java" ? "id" : "identifier") ?? e.nbt.value.get("id"));
function foreignLines(volume, target, skip = () => false) {
  const tally = new Tally();
  volume.eachBlockEntity((x2, y, z, e) => {
    if (e.edition !== target && !skip(x2, y, z, e)) tally.addBlockEntity(blockEntityKind(e));
  });
  for (const e of volume.entities) if (e.edition !== target) tally.addEntity(entityKind(e));
  return tally.lines(
    target === "java" ? "Bedrock NBT cannot be translated to Java" : "Java NBT cannot be translated to Bedrock"
  );
}

// packages/core/src/codecs/litematic.ts
function bitsFor(paletteSize) {
  return Math.max(2, 32 - Math.clz32(Math.max(paletteSize - 1, 1)));
}
function unpack(words, bits2, count) {
  const needed = Math.ceil(count * bits2 / 64);
  if (words.length < needed) {
    throw new CodecError(`BlockStates holds ${words.length} longs; ${needed} are needed`);
  }
  const mask = (1n << BigInt(bits2)) - 1n;
  const out = new Int32Array(count);
  for (let i2 = 0; i2 < count; i2++) {
    const start = i2 * bits2;
    const wi = Math.floor(start / 64);
    const off = BigInt(start % 64);
    let v = BigInt.asUintN(64, words[wi]) >> off;
    if (off + BigInt(bits2) > 64n) {
      v |= BigInt.asUintN(64, words[wi + 1]) << 64n - off;
    }
    out[i2] = Number(v & mask);
  }
  return out;
}
function pack(values, bits2) {
  const words = new BigInt64Array(Math.ceil(values.length * bits2 / 64));
  const mask = (1n << BigInt(bits2)) - 1n;
  for (let i2 = 0; i2 < values.length; i2++) {
    const v = BigInt(values[i2]) & mask;
    const start = i2 * bits2;
    const wi = Math.floor(start / 64);
    const off = BigInt(start % 64);
    words[wi] = BigInt.asIntN(64, BigInt.asUintN(64, words[wi]) | v << off);
    if (off + BigInt(bits2) > 64n) {
      words[wi + 1] = BigInt.asIntN(
        64,
        BigInt.asUintN(64, words[wi + 1]) | v >> 64n - off
      );
    }
  }
  return words;
}
function xyz(tag, what) {
  const c = asCompound(tag, what);
  return [
    asNumber(child(c, "x"), `${what}.x`),
    asNumber(child(c, "y"), `${what}.y`),
    asNumber(child(c, "z"), `${what}.z`)
  ];
}
function paletteState(entry) {
  const e = asCompound(entry, "palette entry");
  const nameTag = child(e, "Name") ?? child(e, "id");
  if (nameTag?.type !== "string") throw new CodecError("palette entry has no Name");
  const props = /* @__PURE__ */ new Map();
  const p = child(e, "Properties") ?? child(e, "properties");
  if (p !== void 0) {
    for (const [k, v] of asCompound(p, "Properties").value) {
      props.set(k, v.type === "string" ? v.value : String(v.value));
    }
  }
  return canonicalize(join(nameTag.value, props));
}
function regionBox(name, regionTag) {
  const region = asCompound(regionTag, `region ${name}`);
  const pos = xyz(child(region, "Position"), "Position");
  const size = xyz(child(region, "Size"), "Size");
  const abs = size.map(Math.abs);
  const min = pos.map((p, i2) => p + Math.min(0, size[i2] + 1));
  return { min, abs, region };
}
function metadataString(root, key2) {
  const meta = child(root, "Metadata");
  const v = meta?.type === "compound" ? child(meta, key2) : void 0;
  return v?.type === "string" ? v.value : null;
}
async function readLitematic(bytes, options = {}) {
  let root;
  try {
    root = (await readNbtFile(bytes)).tag;
  } catch (e) {
    throw new CodecError(`not a readable NBT file (${e instanceof Error ? e.message : String(e)})`);
  }
  const version = asNumber(child(root, "Version"), "Version");
  if (version < 5 || version > 7) {
    throw new CodecError(`unsupported litematic version ${version} (expected 5 to 7)`);
  }
  const regions = asCompound(child(root, "Regions"), "Regions");
  let lo = null;
  let hi = null;
  for (const [name, regionTag] of regions.value) {
    const { min, abs } = regionBox(name, regionTag);
    if (abs[0] * abs[1] * abs[2] === 0) continue;
    lo ??= [...min];
    hi ??= [...min];
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], min[a]);
      hi[a] = Math.max(hi[a], min[a] + abs[a] - 1);
    }
  }
  if (lo !== null && hi !== null) {
    checkExtent([hi[0] - lo[0] + 1, hi[1] - lo[1] + 1, hi[2] - lo[2] + 1], options);
  }
  const lost = new Tally();
  const dropped = new BlockTally();
  const warnings = [];
  let ticks = 0;
  const read2 = [];
  for (const [name, regionTag] of regions.value) {
    const { min, abs, region } = regionBox(name, regionTag);
    const total2 = abs[0] * abs[1] * abs[2];
    const tileEntities = child(region, "TileEntities");
    const entities = child(region, "Entities");
    for (const key2 of ["PendingBlockTicks", "PendingFluidTicks"]) {
      const t = child(region, key2);
      if (t?.type === "list") ticks += t.value.length;
    }
    if (total2 === 0) {
      for (const t of tileEntities?.type === "list" ? tileEntities.value : []) {
        lost.addBlockEntity(t.type === "compound" ? kindOf(child(t, "id")) : "unknown");
      }
      for (const t of entities?.type === "list" ? entities.value : []) {
        lost.addEntity(t.type === "compound" ? kindOf(child(t, "id")) : "unknown");
      }
      continue;
    }
    if (total2 > 2147483647) throw new CodecError(`region ${name} is too large`);
    const paletteTag = child(region, "BlockStatePalette");
    if (paletteTag?.type !== "list")
      throw new CodecError(`region ${name} has no BlockStatePalette`);
    const palette = paletteTag.value.map(paletteState);
    const statesTag = child(region, "BlockStates");
    if (statesTag?.type !== "longArray") throw new CodecError(`region ${name} has no BlockStates`);
    const idx = unpack(statesTag.value, bitsFor(palette.length), total2);
    const [w, , l] = abs;
    const kept = (i2, count = false) => {
      const state = palette[idx[i2]];
      if (state === void 0)
        throw new CodecError(`region ${name} uses palette index ${idx[i2]} outside its palette`);
      const base = state.split("[", 1)[0];
      const kind = count ? dropped.note(base) : classifyBlock(base);
      if (kind === "skip") return void 0;
      if (kind === "air" && !options.keepAir) return void 0;
      return kind === "air" ? AIR : state;
    };
    const r = { blocks: [], blockEntities: [], entities: [], min };
    for (let i2 = 0; i2 < total2; i2++) {
      const state = kept(i2, true);
      if (state === void 0) continue;
      const x2 = i2 % w;
      const z = Math.floor(i2 / w) % l;
      const y = Math.floor(i2 / (w * l));
      r.blocks.push([min[0] + x2, min[1] + y, min[2] + z, state]);
    }
    for (const t of tileEntities?.type === "list" ? tileEntities.value : []) {
      if (t.type !== "compound") {
        lost.addBlockEntity("unknown");
        continue;
      }
      const kind = kindOf(child(t, "id"));
      const rel = [child(t, "x"), child(t, "y"), child(t, "z")].map(
        (v) => v !== void 0 && (v.type === "int" || v.type === "short" || v.type === "byte") ? v.value : Number.NaN
      );
      const inside = rel.every((v, i2) => Number.isInteger(v) && v >= 0 && v < abs[i2]);
      if (!inside || kept((rel[1] * l + rel[2]) * w + rel[0]) === void 0) {
        lost.addBlockEntity(kind);
        continue;
      }
      r.blockEntities.push({
        pos: [min[0] + rel[0], min[1] + rel[1], min[2] + rel[2]],
        nbt: compound(entriesWithout(t, POSITION_KEYS))
      });
    }
    for (const t of entities?.type === "list" ? entities.value : []) {
      if (t.type !== "compound" || entityPosition(t) === void 0) {
        lost.addEntity(t.type === "compound" ? kindOf(child(t, "id")) : "unknown");
        continue;
      }
      r.entities.push({ edition: "java", nbt: t });
    }
    read2.push(r);
  }
  const volume = new Volume();
  let [mx, my, mz] = [0, 0, 0];
  if (read2.some((r) => r.blocks.length > 0)) {
    mx = my = mz = Number.POSITIVE_INFINITY;
    for (const r of read2) {
      for (const [x2, y, z] of r.blocks) {
        if (x2 < mx) mx = x2;
        if (y < my) my = y;
        if (z < mz) mz = z;
      }
    }
  }
  let overwritten = 0;
  for (const r of read2) {
    for (const [x2, y, z, s] of r.blocks) {
      if (volume.indexAt(x2 - mx, y - my, z - mz) >= 0) overwritten++;
      volume.set(x2 - mx, y - my, z - mz, s);
      volume.deleteBlockEntity(x2 - mx, y - my, z - mz);
    }
    for (const { pos, nbt } of r.blockEntities) {
      volume.setBlockEntity(pos[0] - mx, pos[1] - my, pos[2] - mz, { edition: "java", nbt });
    }
    for (const e of r.entities) {
      volume.addEntity(shiftEntity(e, r.min[0] - mx, r.min[1] - my, r.min[2] - mz));
    }
  }
  warnings.push(...lost.lines("their position holds no block, or is missing or malformed"));
  warnings.push(...dropped.lines());
  if (regions.value.size > 1) {
    warnings.push(`${regions.value.size} regions flattened into one`);
    if (overwritten > 0) {
      warnings.push(
        `${overwritten} ${overwritten === 1 ? "cell" : "cells"} overwritten where regions overlap (the later region wins)`
      );
    }
  }
  if (ticks > 0) warnings.push(`${ticks} pending block and fluid ticks not carried over`);
  const dv = child(root, "MinecraftDataVersion");
  return {
    volume,
    meta: {
      version,
      dataVersion: dv === void 0 ? null : asNumber(dv, "MinecraftDataVersion"),
      regionCount: regions.value.size,
      name: metadataString(root, "Name"),
      author: metadataString(root, "Author"),
      description: metadataString(root, "Description"),
      droppedBlockEntities: lost.blockEntityCount,
      droppedEntities: lost.entityCount
    },
    warnings
  };
}
function buildLitematic(volume, options) {
  const dense = volume.toDense();
  const [w, h, l] = dense.size;
  if (dense.data.length === 0) throw new CodecError("build is empty — nothing to export");
  const warnings = [...foreignLines(volume, "java")];
  const states = [AIR];
  const remap2 = new Int32Array(dense.palette.length);
  dense.palette.forEach((p, i2) => {
    const brace = p.indexOf("{");
    let state = p;
    if (brace !== -1) {
      warnings.push(
        `palette entry '${p}' carries block-entity NBT which .litematic export drops (no tile entities are written)`
      );
      state = p.slice(0, brace);
    }
    if (state === AIR) {
      remap2[i2] = 0;
      return;
    }
    let at = states.indexOf(state);
    if (at === -1) {
      states.push(state);
      at = states.length - 1;
    }
    remap2[i2] = at;
  });
  const total2 = w * h * l;
  const values = new Int32Array(total2);
  let blocks = 0;
  for (let y = 0; y < h; y++) {
    for (let z = 0; z < l; z++) {
      for (let x2 = 0; x2 < w; x2++) {
        const v = dense.data[(x2 * h + y) * l + z];
        if (v < 0) continue;
        const idx = remap2[v];
        values[(y * l + z) * w + x2] = idx;
        if (idx !== 0) blocks++;
      }
    }
  }
  const palette = states.map((s) => {
    const bracket = s.indexOf("[");
    const entry = compound([["Name", string(bracket === -1 ? s : s.slice(0, bracket))]]);
    if (bracket !== -1) {
      const props = compound();
      for (const item of s.slice(bracket + 1, -1).split(",")) {
        const eq = item.indexOf("=");
        props.value.set(item.slice(0, eq), string(item.slice(eq + 1)));
      }
      entry.value.set("Properties", props);
    }
    return entry;
  });
  const vec = (a, b, c) => compound([
    ["x", int2(a)],
    ["y", int2(b)],
    ["z", int2(c)]
  ]);
  const [ox, oy, oz] = dense.origin;
  const tileEntities = [];
  volume.eachBlockEntity((x2, y, z, e) => {
    if (e.edition === "java") {
      tileEntities.push({ x: x2 - ox, y: y - oy, z: z - oz, nbt: e.nbt });
    }
  });
  tileEntities.sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
  const tiles = tileEntities.map(
    ({ x: x2, y, z, nbt }) => compound([["x", int2(x2)], ["y", int2(y)], ["z", int2(z)], ...entriesWithout(nbt, POSITION_KEYS)])
  );
  const mobs = volume.entities.filter((e) => e.edition === "java").map((e) => shiftEntity(e, -ox, -oy, -oz).nbt);
  const time = BigInt(options.time ?? 0);
  const region = compound([
    ["Position", vec(0, 0, 0)],
    ["Size", vec(w, h, l)],
    ["BlockStatePalette", list(TagId.Compound, palette)],
    ["BlockStates", longArray(pack(values, bitsFor(palette.length)))],
    ["TileEntities", list(TagId.Compound, tiles)],
    ["Entities", list(TagId.Compound, mobs)],
    ["PendingBlockTicks", list(TagId.Compound, [])],
    ["PendingFluidTicks", list(TagId.Compound, [])]
  ]);
  const root = compound([
    ["Version", int2(6)],
    ["MinecraftDataVersion", int2(options.dataVersion)],
    [
      "Metadata",
      compound([
        ["Name", string(options.name ?? "voxwright")],
        ["Author", string(options.author ?? "")],
        ["Description", string(options.description ?? "")],
        ["RegionCount", int2(1)],
        ["TimeCreated", long(time)],
        ["TimeModified", long(time)],
        ["TotalBlocks", int2(blocks)],
        ["TotalVolume", int2(total2)],
        ["EnclosingSize", vec(w, h, l)]
      ])
    ],
    ["Regions", compound([["Main", region]])]
  ]);
  return { root, warnings };
}
async function writeLitematic(volume, options) {
  const { root, warnings } = buildLitematic(volume, options);
  return { bytes: await writeNbtGzip({ name: "Litematic", tag: root }), warnings };
}

// packages/core/src/codecs/mcstructure.ts
var BLOCK_VERSION = 18168865;
var BED_KEYS = /* @__PURE__ */ new Set(["id", "color", "isMovable", "x", "y", "z"]);
function isPlainBed(be) {
  if (be.value.get("id")?.type !== "string" || be.value.get("id").value !== "Bed")
    return false;
  for (const [k, v] of be.value) {
    if (!BED_KEYS.has(k)) return false;
    if (k === "isMovable" && !(v.type === "byte" && v.value === 1)) return false;
  }
  return be.value.has("color");
}
function scalar(tag) {
  if (tag.type === "string") return tag.value;
  if (tag.type === "byte" || tag.type === "short" || tag.type === "int") return tag.value;
  if (tag.type === "long") return Number(tag.value);
  throw new CodecError(`unexpected ${tag.type} tag in block states`);
}
async function readMcstructure(bytes, options = {}) {
  let root;
  try {
    root = (await readNbtFile(bytes, { endian: "little" })).tag;
  } catch (e) {
    throw new CodecError(`not a readable NBT file (${e instanceof Error ? e.message : String(e)})`);
  }
  const sizeTag = child(root, "size");
  if (sizeTag?.type !== "list" || sizeTag.value.length !== 3) {
    throw new CodecError("not a .mcstructure (no size)");
  }
  const [sx, sy, sz] = sizeTag.value.map((v, i3) => asNumber(v, `size[${i3}]`));
  checkExtent([sx, sy, sz], options);
  const structure = asCompound(child(root, "structure"), "structure");
  const indicesTag = child(structure, "block_indices");
  const paletteRoot = child(asCompound(child(structure, "palette"), "palette"), "default");
  if (indicesTag?.type !== "list" || indicesTag.value.length === 0) {
    throw new CodecError("not a .mcstructure (no block_indices)");
  }
  const layers = indicesTag.value.map((l) => {
    if (l.type === "intArray") return Array.from(l.value);
    if (l.type === "list") return l.value.map((v) => asNumber(v, "block index"));
    throw new CodecError("block_indices layers must be lists");
  });
  const palContainer = asCompound(paletteRoot, "palette.default");
  const paletteList = child(palContainer, "block_palette");
  if (paletteList?.type !== "list") throw new CodecError("no block_palette");
  const total2 = sx * sy * sz;
  if (total2 < 0 || total2 > 2147483647) throw new CodecError(`invalid size ${sx}x${sy}x${sz}`);
  const main2 = layers[0];
  if (main2.length !== total2) {
    throw new CodecError(`block_indices holds ${main2.length} entries for ${sx}x${sy}x${sz}`);
  }
  const positionData = child(palContainer, "block_position_data");
  const bedColor = /* @__PURE__ */ new Map();
  const lost = new Tally();
  const pendingBlockEntities = /* @__PURE__ */ new Map();
  let ticks = 0;
  if (positionData?.type === "compound") {
    for (const [key2, entry] of positionData.value) {
      if (entry.type !== "compound") continue;
      if (child(entry, "tick_queue_data") !== void 0) ticks++;
      const be = child(entry, "block_entity_data");
      if (be?.type !== "compound") continue;
      const cell = Number(key2);
      const color = child(be, "color");
      const idTag = child(be, "id");
      if (idTag?.type === "string" && idTag.value === "Bed" && color !== void 0) {
        bedColor.set(cell, asNumber(color, "bed color"));
      }
      if (isPlainBed(be)) continue;
      if (!Number.isInteger(cell) || cell < 0 || cell >= total2) lost.addBlockEntity(kindOf(idTag));
      else pendingBlockEntities.set(cell, be);
    }
  }
  const warnings = /* @__PURE__ */ new Set();
  const entries2 = paletteList.value.map((e) => {
    const c = asCompound(e, "palette entry");
    const name = child(c, "name");
    if (name?.type !== "string") throw new CodecError("palette entry has no name");
    const states = /* @__PURE__ */ new Map();
    const st = child(c, "states");
    if (st?.type === "compound") for (const [k, v] of st.value) states.set(k, scalar(v));
    return { name: name.value, states };
  });
  const translated = /* @__PURE__ */ new Map();
  const javaOf = (idx, color) => {
    const key2 = `${idx}/${color ?? ""}`;
    let state = translated.get(key2);
    if (state === void 0) {
      const e = entries2[idx];
      if (e === void 0) throw new CodecError(`block index ${idx} is outside the palette`);
      const r = bedrockToJava(e.name, e.states, color === void 0 ? {} : { bedColor: color });
      for (const w of r.warnings) warnings.add(w);
      state = r.state;
      translated.set(key2, state);
    }
    return state;
  };
  const water = /* @__PURE__ */ new Set();
  entries2.forEach((e, i3) => {
    if (e.name === "minecraft:water" || e.name === "minecraft:flowing_water") water.add(i3);
  });
  const second = layers[1];
  const kept = [];
  const dropped = new BlockTally();
  const unknown = /* @__PURE__ */ new Map();
  let i2 = 0;
  for (let x2 = 0; x2 < sx; x2++) {
    for (let y = 0; y < sy; y++) {
      for (let z = 0; z < sz; z++, i2++) {
        const idx = main2[i2];
        if (idx < 0) continue;
        let state = javaOf(idx, bedColor.get(i2));
        const base = state.split("[", 1)[0];
        const kind = dropped.note(base);
        if (kind === "skip") continue;
        if (kind === "air") {
          if (options.keepAir) kept.push([x2, y, z, AIR]);
          continue;
        }
        if (options.knownBlocks !== void 0 && !options.knownBlocks.has(base)) {
          unknown.set(base, (unknown.get(base) ?? 0) + 1);
        }
        const layer2 = second?.[i2];
        if (layer2 !== void 0 && water.has(layer2)) {
          const parsed = parse(state);
          parsed.props.set("waterlogged", "true");
          state = canonicalize(
            `${parsed.name}[${[...parsed.props].map(([k, v]) => `${k}=${v}`).join(",")}]`
          );
        }
        kept.push([x2, y, z, state]);
      }
    }
  }
  const volume = new Volume();
  let [mx, my, mz] = [0, 0, 0];
  if (kept.length > 0) {
    mx = my = mz = Number.POSITIVE_INFINITY;
    for (const [x2, y, z] of kept) {
      if (x2 < mx) mx = x2;
      if (y < my) my = y;
      if (z < mz) mz = z;
    }
    for (const [x2, y, z, s] of kept) volume.set(x2 - mx, y - my, z - mz, s);
  }
  for (const [cell, be] of pendingBlockEntities) {
    const x2 = Math.floor(cell / (sy * sz)) - mx;
    const y = Math.floor(cell / sz) % sy - my;
    const z = cell % sz - mz;
    if (volume.indexAt(x2, y, z) < 0) lost.addBlockEntity(kindOf(child(be, "id")));
    else {
      const entity = {
        edition: "bedrock",
        nbt: compound(entriesWithout(be, POSITION_KEYS))
      };
      volume.setBlockEntity(x2, y, z, entity);
    }
  }
  const entities = child(structure, "entities");
  for (const raw of entities?.type === "list" ? entities.value : []) {
    if (raw.type !== "compound" || entityPosition(raw) === void 0) {
      lost.addEntity(
        raw.type === "compound" ? kindOf(child(raw, "identifier") ?? child(raw, "id")) : "unknown"
      );
      continue;
    }
    volume.addEntity(shiftEntity({ edition: "bedrock", nbt: raw }, -mx, -my, -mz));
  }
  for (const line2 of lost.lines("their position holds no block, or is missing or malformed")) {
    warnings.add(line2);
  }
  for (const line2 of dropped.lines()) warnings.add(line2);
  if (unknown.size > 0) {
    let total3 = 0;
    for (const c of unknown.values()) total3 += c;
    warnings.add(
      `${total3} ${total3 === 1 ? "block" : "blocks"} not translated, kept as is (the name is not a known Java block): ${describeCounts(unknown)}`
    );
  }
  if (ticks > 0) warnings.add(`${ticks} pending block ticks not carried over`);
  const fv = child(root, "format_version");
  return {
    volume,
    meta: {
      formatVersion: fv === void 0 ? null : asNumber(fv, "format_version"),
      size: [sx, sy, sz],
      droppedBlockEntities: lost.blockEntityCount,
      droppedEntities: lost.entityCount
    },
    warnings: [...warnings]
  };
}
function valueTag(v) {
  if (v.kind === "byte") return byte2(v.value);
  if (v.kind === "int") return int2(v.value);
  return string(v.value);
}
function buildMcstructure(volume) {
  const dense = volume.toDense();
  const [sx, sy, sz] = dense.size;
  if (dense.data.length === 0) throw new CodecError("build is empty — nothing to export");
  const warnings = /* @__PURE__ */ new Set();
  const palette = [];
  const index = /* @__PURE__ */ new Map();
  const intern = (name, states) => {
    const keys = [...states.keys()].sort();
    const sig = name + JSON.stringify(keys.map((k) => [k, states.get(k)]));
    let at = index.get(sig);
    if (at === void 0) {
      at = palette.length;
      index.set(sig, at);
      palette.push(
        compound([
          ["name", string(name)],
          [
            "states",
            compound(keys.map((k) => [k, valueTag(states.get(k))]))
          ],
          ["version", int2(BLOCK_VERSION)]
        ])
      );
    }
    return at;
  };
  const perPalette = dense.palette.map((canonical2) => {
    const brace = canonical2.indexOf("{");
    let state = canonical2;
    if (brace !== -1) {
      warnings.add(
        `palette entry '${canonical2}' carries block-entity NBT which .mcstructure export drops`
      );
      state = canonical2.slice(0, brace);
    }
    const r = javaToBedrock(state);
    for (const w of r.warnings) warnings.add(w);
    return r;
  });
  const [ox, oy, oz] = dense.origin;
  for (const line2 of foreignLines(volume, "bedrock", (x2, y, z, e) => {
    const v = dense.data[((x2 - ox) * sy + (y - oy)) * sz + (z - oz)];
    const id = e.nbt.value.get("id");
    return e.nbt.value.size === 1 && id?.type === "string" && id.value === "minecraft:bed" && perPalette[v]?.bedColor !== void 0;
  })) {
    warnings.add(line2);
  }
  const mapped = perPalette.map((r) => intern(r.block.name, r.block.states));
  const waterIdx = perPalette.some((r) => r.waterlogged) ? intern("minecraft:water", /* @__PURE__ */ new Map([["liquid_depth", { kind: "int", value: 0 }]])) : -1;
  const main2 = [];
  const layer2 = [];
  const positionData = compound();
  let i2 = 0;
  for (let x2 = 0; x2 < sx; x2++) {
    for (let y = 0; y < sy; y++) {
      for (let z = 0; z < sz; z++, i2++) {
        const v = dense.data[i2];
        main2.push(int2(v < 0 ? -1 : mapped[v]));
        const r = v < 0 ? void 0 : perPalette[v];
        layer2.push(int2(r?.waterlogged ? waterIdx : -1));
        const stored = volume.blockEntityAt(ox + x2, oy + y, oz + z);
        if (stored?.edition === "bedrock") {
          positionData.value.set(
            String(i2),
            compound([
              [
                "block_entity_data",
                compound([
                  ...entriesWithout(stored.nbt, POSITION_KEYS),
                  ["x", int2(x2)],
                  ["y", int2(y)],
                  ["z", int2(z)]
                ])
              ]
            ])
          );
        } else if (r?.bedColor !== void 0) {
          positionData.value.set(
            String(i2),
            compound([
              [
                "block_entity_data",
                compound([
                  ["color", byte2(r.bedColor)],
                  ["id", string("Bed")],
                  ["x", int2(x2)],
                  ["y", int2(y)],
                  ["z", int2(z)]
                ])
              ]
            ])
          );
        }
      }
    }
  }
  const mobs = volume.entities.filter((e) => e.edition === "bedrock").map((e) => shiftEntity(e, -ox, -oy, -oz).nbt);
  const root = compound([
    ["format_version", int2(1)],
    ["size", list(TagId.Int, [int2(sx), int2(sy), int2(sz)])],
    [
      "structure",
      compound([
        ["block_indices", list(TagId.List, [list(TagId.Int, main2), list(TagId.Int, layer2)])],
        ["entities", list(TagId.Compound, mobs)],
        [
          "palette",
          compound([
            [
              "default",
              compound([
                ["block_palette", list(TagId.Compound, palette)],
                ["block_position_data", positionData]
              ])
            ]
          ])
        ]
      ])
    ],
    ["structure_world_origin", list(TagId.Int, [int2(0), int2(0), int2(0)])]
  ]);
  return { root: { name: "", tag: root }, warnings: [...warnings] };
}
function writeMcstructure(volume) {
  const { root, warnings } = buildMcstructure(volume);
  return { bytes: writeNbt(root, { endian: "little" }), warnings };
}

// packages/core/src/codecs/schem.ts
var LEGACY_SCHEMATIC_MESSAGE = "this is a legacy .schematic file (the pre-1.13 MCEdit format with numeric block IDs), which is not supported; re-save it as .schem (for example with WorldEdit in Minecraft 1.13 or later) and open that";
function isLegacySchematic(top) {
  if (child(top, "Version") !== void 0 || child(top, "Palette") !== void 0) return false;
  if (child(top, "Schematic")?.type === "compound") return false;
  return child(top, "Materials")?.type === "string" || child(top, "Blocks")?.type === "byteArray";
}
function readVarint(data, pos) {
  let value = 0;
  let shift = 0;
  let p = pos;
  for (; ; ) {
    const b = data[p++];
    if (b === void 0) throw new CodecError("BlockData ends inside a varint");
    value += (b & 127) * 2 ** shift;
    if ((b & 128) === 0) break;
    shift += 7;
    if (shift > 35) throw new CodecError("BlockData varint is too long");
  }
  return [value, p];
}
function writeVarint(out, value) {
  let v = value;
  while (v >= 128) {
    out.push(v % 128 | 128);
    v = Math.floor(v / 128);
  }
  out.push(v);
}
function dimension(tag, name) {
  return asNumber(child(tag, name), name) & 65535;
}
function readOffset(tag) {
  const t = child(tag, "Offset");
  if (t?.type === "intArray" && t.value.length === 3) {
    return [t.value[0], t.value[1], t.value[2]];
  }
  return [0, 0, 0];
}
function compoundList(tag) {
  return tag?.type === "list" ? tag.value : [];
}
function canonical(id, head, rest, skip) {
  const out = compound();
  if (id?.type === "string") out.value.set("id", id);
  for (const [k, v] of head) out.value.set(k, v);
  for (const [k, v] of rest)
    if (!skip.has(k) && !(k === "id" && id?.type === "string")) out.value.set(k, v);
  return out;
}
function readBlockEntities(volume, list2, version, lost) {
  for (const raw of list2) {
    if (raw.type !== "compound") {
      lost.addBlockEntity("unknown");
      continue;
    }
    const idTag = child(raw, "Id") ?? child(raw, "id");
    const pos = child(raw, "Pos");
    if (pos?.type !== "intArray" || pos.value.length !== 3) {
      lost.addBlockEntity(kindOf(idTag));
      continue;
    }
    const data = child(raw, "Data");
    const rest = version === 2 ? [...raw.value] : [
      ...entriesWithout(raw, /* @__PURE__ */ new Set(["Id", "id", "Pos", "Data"])),
      ...data?.type === "compound" ? [...data.value] : []
    ];
    const skip = /* @__PURE__ */ new Set([...POSITION_KEYS, ...version === 2 ? ["Id", "Pos"] : []]);
    const nbt = canonical(idTag, [], rest, skip);
    const [x2, y, z] = [pos.value[0], pos.value[1], pos.value[2]];
    attachBlockEntity(volume, x2, y, z, { edition: "java", nbt }, lost, kindOf(idTag));
  }
}
function readEntities(volume, list2, version, lost) {
  for (const raw of list2) {
    if (raw.type !== "compound") {
      lost.addEntity("unknown");
      continue;
    }
    const idTag = child(raw, "Id") ?? child(raw, "id");
    const pos = child(raw, "Pos");
    const data = child(raw, "Data");
    const rest = version === 2 ? [...raw.value] : [
      ...entriesWithout(raw, /* @__PURE__ */ new Set(["Id", "id", "Pos", "Data"])),
      ...data?.type === "compound" ? [...data.value] : []
    ];
    const nbt = canonical(
      idTag,
      pos === void 0 ? [] : [["Pos", pos]],
      rest,
      /* @__PURE__ */ new Set(["Id", "Pos"])
    );
    if (entityPosition(nbt) === void 0) {
      lost.addEntity(kindOf(idTag));
      continue;
    }
    volume.addEntity({ edition: "java", nbt });
  }
}
async function readSchem(bytes, options = {}) {
  let top;
  try {
    top = (await readNbtFile(bytes)).tag;
  } catch (e) {
    throw new CodecError(`not a readable NBT file (${e instanceof Error ? e.message : String(e)})`);
  }
  if (isLegacySchematic(top)) throw new CodecError(LEGACY_SCHEMATIC_MESSAGE);
  const nested = child(top, "Schematic");
  const isV3 = nested?.type === "compound";
  const schem = isV3 ? nested : top;
  const version = asNumber(child(schem, "Version"), "Version");
  if (version !== 2 && version !== 3) {
    throw new CodecError(`unsupported Sponge schematic version ${version} (expected 2 or 3)`);
  }
  if (version === 3 !== isV3) {
    throw new CodecError(`Sponge schematic version ${version} has the wrong layout`);
  }
  const width = dimension(schem, "Width");
  const height = dimension(schem, "Height");
  const length = dimension(schem, "Length");
  checkExtent([width, height, length], options);
  let paletteTag;
  let dataTag;
  let blockEntities;
  if (version === 3) {
    const blocks = asCompound(child(schem, "Blocks"), "Blocks");
    paletteTag = child(blocks, "Palette");
    dataTag = child(blocks, "Data");
    blockEntities = child(blocks, "BlockEntities");
  } else {
    paletteTag = child(schem, "Palette");
    dataTag = child(schem, "BlockData");
    blockEntities = child(schem, "BlockEntities");
  }
  const palette = asCompound(paletteTag, "Palette");
  if (dataTag?.type !== "byteArray") throw new CodecError("block data must be a byte array");
  const data = new Uint8Array(
    dataTag.value.buffer,
    dataTag.value.byteOffset,
    dataTag.value.byteLength
  );
  const states = /* @__PURE__ */ new Map();
  for (const [key2, value] of palette.value) {
    const id = asNumber(value, `palette id for ${key2}`);
    let canonical2;
    try {
      canonical2 = canonicalize(key2);
    } catch (e) {
      throw new CodecError(
        `bad palette entry '${key2}': ${e instanceof Error ? e.message : String(e)}`
      );
    }
    states.set(id, canonical2.includes(":") ? canonical2 : `minecraft:${canonical2}`);
  }
  const total2 = width * height * length;
  if (total2 > 2147483647)
    throw new CodecError(`schematic ${width}x${height}x${length} is too large`);
  if (data.length < total2) {
    throw new CodecError(
      `block data holds fewer than ${total2} entries for ${width}x${height}x${length}`
    );
  }
  const volume = new Volume();
  const dropped = new BlockTally();
  let pos = 0;
  for (let i2 = 0; i2 < total2; i2++) {
    let id;
    [id, pos] = readVarint(data, pos);
    const state = states.get(id);
    if (state === void 0)
      throw new CodecError(`block data uses palette id ${id} which is not defined`);
    const name = state.split("[", 1)[0];
    const kind = dropped.note(name);
    if (kind === "skip" || kind === "air" && !options.keepAir) continue;
    const x2 = i2 % width;
    const z = Math.floor(i2 / width) % length;
    const y = Math.floor(i2 / (width * length));
    volume.set(x2, y, z, kind === "air" ? AIR : state);
  }
  const lost = new Tally();
  readBlockEntities(volume, compoundList(blockEntities), version, lost);
  readEntities(volume, compoundList(child(schem, "Entities")), version, lost);
  const warnings = [...lost.lines("their position holds no block, or is missing or malformed")];
  warnings.push(...dropped.lines());
  const metadata = child(schem, "Metadata");
  if (metadata?.type === "compound" && metadata.value.size > 0) {
    warnings.push(`Metadata not carried over (${[...metadata.value.keys()].join(", ")})`);
  }
  if (child(schem, version === 3 ? "Biomes" : "BiomeData") !== void 0) {
    warnings.push("biomes not carried over (a volume holds no biomes)");
  }
  const dv = child(schem, "DataVersion");
  return {
    volume,
    meta: {
      version,
      dataVersion: dv === void 0 ? null : asNumber(dv, "DataVersion"),
      offset: readOffset(schem),
      width,
      height,
      length,
      droppedBlockEntities: lost.blockEntityCount,
      droppedEntities: lost.entityCount
    },
    warnings
  };
}
function carriedOffset(volume, offset) {
  const bounds = volume.placedBounds();
  const corner = bounds === null ? [0, 0, 0] : bounds[0];
  return [offset[0] + corner[0], offset[1] + corner[1], offset[2] + corner[2]];
}
function writeBlockEntities(volume, origin, version) {
  const found = [];
  volume.eachBlockEntity((x2, y, z, e) => {
    if (e.edition === "java")
      found.push({ x: x2 - origin[0], y: y - origin[1], z: z - origin[2], nbt: e.nbt });
  });
  found.sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
  return found.map(({ x: x2, y, z, nbt }) => {
    const out = compound();
    const id = nbt.value.get("id");
    if (id !== void 0) out.value.set("Id", id);
    out.value.set("Pos", intArray(Int32Array.of(x2, y, z)));
    const rest = entriesWithout(nbt, /* @__PURE__ */ new Set(["id"]));
    if (version === 2) for (const [k, v] of rest) out.value.set(k, v);
    else out.value.set("Data", compound(rest));
    return out;
  });
}
function writeEntities(volume, origin, version) {
  return volume.entities.filter((e) => e.edition === "java").map((e) => {
    const { nbt } = shiftEntity(e, -origin[0], -origin[1], -origin[2]);
    const out = compound();
    const id = nbt.value.get("id");
    if (id !== void 0) out.value.set("Id", id);
    out.value.set("Pos", nbt.value.get("Pos"));
    const rest = entriesWithout(nbt, /* @__PURE__ */ new Set(["id", "Pos"]));
    if (version === 2) for (const [k, v] of rest) out.value.set(k, v);
    else out.value.set("Data", compound(rest));
    return out;
  });
}
function buildSchem(volume, options) {
  const version = options.version ?? 3;
  if (version !== 2 && version !== 3)
    throw new CodecError(`unsupported version ${String(version)}`);
  const dense = volume.toDense();
  const [width, height, length] = dense.size;
  if (dense.data.length === 0) throw new CodecError("build is empty — nothing to export");
  for (const [axis, n2] of [
    ["Width", width],
    ["Height", height],
    ["Length", length]
  ]) {
    if (n2 > 65535) throw new CodecError(`${axis} ${n2} does not fit in an unsigned short`);
  }
  const warnings = [...foreignLines(volume, "java")];
  const ids = /* @__PURE__ */ new Map();
  const paletteTag = compound();
  const idOf = (state) => {
    let id = ids.get(state);
    if (id === void 0) {
      id = ids.size;
      ids.set(state, id);
      paletteTag.value.set(state, int2(id));
    }
    return id;
  };
  const out = [];
  const warned = /* @__PURE__ */ new Set();
  for (let y = 0; y < height; y++) {
    for (let z = 0; z < length; z++) {
      for (let x2 = 0; x2 < width; x2++) {
        const idx = dense.data[(x2 * height + y) * length + z];
        let state = idx < 0 ? AIR : dense.palette[idx];
        const brace = state.indexOf("{");
        if (brace !== -1) {
          if (!warned.has(state)) {
            warned.add(state);
            warnings.push(
              `palette entry '${state}' carries block-entity NBT which .schem export drops (no block entities are written)`
            );
          }
          state = state.slice(0, brace);
        }
        writeVarint(out, idOf(state));
      }
    }
  }
  const blockEntities = writeBlockEntities(volume, dense.origin, version);
  const entities = writeEntities(volume, dense.origin, version);
  const blockData = byteArray(new Int8Array(Uint8Array.from(out).buffer));
  const offset = options.offset ?? [0, 0, 0];
  const body = [
    ["Version", int2(version)],
    ["DataVersion", int2(options.dataVersion)],
    ["Width", short(width)],
    ["Height", short(height)],
    ["Length", short(length)],
    ["Offset", intArray(Int32Array.from(offset))]
  ];
  if (version === 2) {
    body.push(
      ["PaletteMax", int2(ids.size)],
      ["Palette", paletteTag],
      ["BlockData", blockData],
      ["BlockEntities", list(TagId.Compound, blockEntities)]
    );
    if (entities.length > 0) body.push(["Entities", list(TagId.Compound, entities)]);
    return { root: compound(body), warnings };
  }
  body.push([
    "Blocks",
    compound([
      ["Palette", paletteTag],
      ["Data", blockData],
      ["BlockEntities", list(TagId.Compound, blockEntities)]
    ])
  ]);
  if (entities.length > 0) body.push(["Entities", list(TagId.Compound, entities)]);
  return { root: compound([["Schematic", compound(body)]]), warnings };
}
async function writeSchem(volume, options) {
  const { root, warnings } = buildSchem(volume, options);
  const name = (options.version ?? 3) === 2 ? "Schematic" : "";
  return { bytes: await writeNbtGzip({ name, tag: root }), warnings };
}

// packages/core/src/codecs/structure-nbt.ts
function stateOf(name, props) {
  const full = name.includes(":") ? name : `minecraft:${name}`;
  return canonicalize(join(full, props));
}
function paletteState2(entry) {
  const e = asCompound(entry, "palette entry");
  const nameTag = child(e, "Name") ?? child(e, "id");
  if (nameTag?.type !== "string") throw new CodecError("palette entry has no Name or id");
  const props = /* @__PURE__ */ new Map();
  const propsTag = child(e, "Properties") ?? child(e, "properties");
  if (propsTag !== void 0) {
    for (const [k, v] of asCompound(propsTag, "Properties").value) {
      props.set(k, v.type === "string" ? v.value : String(v.value));
    }
  }
  return stateOf(nameTag.value, props);
}
async function readStructureNbt(bytes, options = {}) {
  let root;
  try {
    root = await readNbtFile(bytes);
  } catch (e) {
    throw new CodecError(`not a readable NBT file (${e instanceof Error ? e.message : String(e)})`);
  }
  const tag = root.tag;
  let paletteTag = child(tag, "palette");
  if (paletteTag === void 0) {
    const variants = child(tag, "palettes");
    if (variants?.type === "list" && variants.value.length > 0) paletteTag = variants.value[0];
  }
  const blocksTag = child(tag, "blocks");
  if (paletteTag?.type !== "list" || blocksTag?.type !== "list") {
    throw new CodecError("not a structure .nbt (no palette/blocks)");
  }
  const declared = child(tag, "size");
  if (declared?.type === "list" && declared.value.length === 3) {
    checkExtent(
      declared.value.map((v, i2) => asNumber(v, `size[${i2}]`)),
      options
    );
  }
  const states = paletteTag.value.map(paletteState2);
  const kept = [];
  const pendingBlockEntities = /* @__PURE__ */ new Map();
  const lost = new Tally();
  const dropped = new BlockTally();
  for (const b of blocksTag.value) {
    const block = asCompound(b, "block");
    const pos = child(block, "pos");
    if (pos?.type !== "list" || pos.value.length !== 3)
      throw new CodecError("block pos must be 3 ints");
    const [x2, y, z] = pos.value.map((v, i2) => asNumber(v, `block pos[${i2}]`));
    const stateIdx = asNumber(child(block, "state"), "block state");
    const state = states[stateIdx];
    if (state === void 0) throw new CodecError(`block state ${stateIdx} is outside the palette`);
    const nbt = child(block, "nbt");
    const name = state.split("[", 1)[0];
    const kind = dropped.note(name);
    const skipped = kind === "skip" || kind === "air" && !options.keepAir;
    if (nbt !== void 0) {
      if (nbt.type === "compound" && !skipped) pendingBlockEntities.set(`${x2},${y},${z}`, nbt);
      else lost.addBlockEntity(kindOf(nbt.type === "compound" ? nbt.value.get("id") : void 0));
    }
    if (kind === "skip") continue;
    if (kind === "air") {
      if (options.keepAir) kept.push([x2, y, z, AIR]);
      continue;
    }
    kept.push([x2, y, z, state]);
  }
  const volume = new Volume();
  let [mx, my, mz] = [0, 0, 0];
  if (kept.length > 0) {
    mx = my = mz = Number.POSITIVE_INFINITY;
    let [hx, hy, hz] = [
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY
    ];
    for (const [x2, y, z] of kept) {
      if (x2 < mx) mx = x2;
      if (y < my) my = y;
      if (z < mz) mz = z;
      if (x2 > hx) hx = x2;
      if (y > hy) hy = y;
      if (z > hz) hz = z;
    }
    checkExtent([hx - mx + 1, hy - my + 1, hz - mz + 1], options);
    for (const [x2, y, z, s] of kept) volume.set(x2 - mx, y - my, z - mz, s);
  }
  for (const [key2, nbt] of pendingBlockEntities) {
    const [x2, y, z] = key2.split(",").map(Number);
    const entity = {
      edition: "java",
      nbt: compound(entriesWithout(nbt, POSITION_KEYS))
    };
    volume.setBlockEntity(x2 - mx, y - my, z - mz, entity);
  }
  const entitiesTag = child(tag, "entities");
  for (const raw of entitiesTag?.type === "list" ? entitiesTag.value : []) {
    const e = raw.type === "compound" ? child(raw, "nbt") : void 0;
    if (raw.type !== "compound" || e?.type !== "compound") {
      lost.addEntity("unknown");
      continue;
    }
    const nbt = compound(e.value);
    const pos = child(raw, "pos");
    if (pos !== void 0) nbt.value.set("Pos", pos);
    if (entityPosition(nbt) === void 0) {
      lost.addEntity(kindOf(e.value.get("id")));
      continue;
    }
    volume.addEntity(shiftEntity({ edition: "java", nbt }, -mx, -my, -mz));
  }
  const dv = child(tag, "DataVersion");
  return {
    volume,
    meta: {
      dataVersion: dv === void 0 ? null : asNumber(dv, "DataVersion"),
      droppedBlockEntities: lost.blockEntityCount,
      droppedEntities: lost.entityCount
    },
    warnings: [
      ...lost.lines("their position holds no block, or is missing or malformed"),
      ...dropped.lines()
    ]
  };
}
var AIR_MODES = ["none", "explicit", "all"];
function buildStructureNbt(volume, options) {
  const airMode = options.air ?? "none";
  if (!AIR_MODES.includes(airMode)) {
    throw new CodecError(`air must be one of ${AIR_MODES.join(", ")}, got '${String(airMode)}'`);
  }
  const dense = volume.toDense();
  const [sx, sy, sz] = dense.size;
  if (dense.data.length === 0) throw new CodecError("build is empty — nothing to export");
  const warnings = [...foreignLines(volume, "java")];
  const palette = [];
  let airIdx = null;
  dense.palette.forEach((canonical2, i2) => {
    const { name, props, nbt } = parse(canonical2);
    if (nbt !== null) {
      warnings.push(
        `palette entry '${canonical2}' carries block-entity NBT which .nbt export drops (no block_entities list is written)`
      );
    }
    const entry = compound([["Name", string(name)]]);
    if (props.size > 0) {
      const keys = [...props.keys()].sort();
      entry.value.set("Properties", compound(keys.map((k) => [k, string(props.get(k))])));
    }
    if (name === AIR) airIdx = i2;
    palette.push(entry);
  });
  if (airMode === "all" && airIdx === null) {
    airIdx = palette.length;
    palette.push(compound([["Name", string(AIR)]]));
  }
  const blocks = [];
  const lost = new Tally();
  const [ox, oy, oz] = dense.origin;
  for (let x2 = 0; x2 < sx; x2++) {
    for (let y = 0; y < sy; y++) {
      for (let z = 0; z < sz; z++) {
        let idx = dense.data[(x2 * sy + y) * sz + z];
        if (idx < 0) {
          if (airMode !== "all") continue;
          idx = airIdx;
        } else if (airMode === "none" && idx === airIdx) {
          continue;
        }
        const block = compound([
          ["pos", list(TagId.Int, [int2(x2), int2(y), int2(z)])],
          ["state", int2(idx)]
        ]);
        const entity = volume.blockEntityAt(ox + x2, oy + y, oz + z);
        if (entity?.edition === "java") block.value.set("nbt", entity.nbt);
        blocks.push(block);
      }
    }
  }
  volume.eachBlockEntity((x2, y, z, e) => {
    if (e.edition !== "java") return;
    const key2 = ((x2 - ox) * sy + (y - oy)) * sz + (z - oz);
    const idx = dense.data[key2];
    if (idx < 0 ? airMode !== "all" : airMode === "none" && idx === airIdx) {
      lost.addBlockEntity(kindOf(e.nbt.value.get("id")));
    }
  });
  warnings.push(...lost.lines("their cell is air, which this export leaves out"));
  const entities = [];
  for (const e of volume.entities) {
    if (e.edition !== "java") continue;
    const moved = shiftEntity(e, -ox, -oy, -oz);
    const p = entityPosition(moved.nbt);
    entities.push(
      compound([
        ["pos", positionTag("java", p[0], p[1], p[2])],
        [
          "blockPos",
          list(TagId.Int, [int2(Math.floor(p[0])), int2(Math.floor(p[1])), int2(Math.floor(p[2]))])
        ],
        ["nbt", moved.nbt]
      ])
    );
  }
  const root = compound([
    ["DataVersion", int2(options.dataVersion)],
    ["size", list(TagId.Int, [int2(sx), int2(sy), int2(sz)])],
    ["palette", list(TagId.Compound, palette)],
    ["blocks", list(TagId.Compound, blocks)],
    ["entities", list(TagId.Compound, entities)]
  ]);
  return { root, warnings };
}
async function writeStructureNbt(volume, options) {
  const { root, warnings } = buildStructureNbt(volume, options);
  return { bytes: await writeNbtGzip({ name: "", tag: root }), warnings };
}

// packages/core/src/edit/command.ts
var EditError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "EditError";
  }
};
var SECTION_BITS2 = 4;
var SECTION_CELLS = 1 << SECTION_BITS2 * 3;
var SECTION_MASK2 = (1 << SECTION_BITS2) - 1;
var SPARSE_BYTES = 20;
var DIFF_BYTES = SECTION_CELLS * 8;
var PENDING = -2;
var localIndex = (x2, y, z) => (y & SECTION_MASK2) << 8 | (z & SECTION_MASK2) << 4 | x2 & SECTION_MASK2;
function isEmptyCommand(command) {
  return command.before.length === 0 && command.sections.length === 0 && command.blockEntities.length === 0;
}
function commandCellCount(command) {
  let n2 = command.before.length;
  for (const d of command.sections) {
    for (let i2 = 0; i2 < SECTION_CELLS; i2++) if (d.before[i2] !== d.after[i2]) n2++;
  }
  return n2;
}
function commandBytes(command) {
  let n2 = 64 + command.label.length * 2;
  n2 += command.positions.byteLength + command.before.byteLength + command.after.byteLength;
  for (const d of command.sections) n2 += d.before.byteLength + d.after.byteLength + 48;
  n2 += command.blockEntities.length * 512;
  return n2;
}
function forEachChange(command, fn) {
  const { positions, before, after } = command;
  for (let i2 = 0; i2 < before.length; i2++) {
    fn(
      positions[3 * i2],
      positions[3 * i2 + 1],
      positions[3 * i2 + 2],
      before[i2],
      after[i2]
    );
  }
  for (const d of command.sections) {
    for (let i2 = 0; i2 < SECTION_CELLS; i2++) {
      const b = d.before[i2];
      const a = d.after[i2];
      if (b === a) continue;
      fn(
        d.sx << SECTION_BITS2 | i2 & SECTION_MASK2,
        d.sy << SECTION_BITS2 | i2 >> 8,
        d.sz << SECTION_BITS2 | i2 >> 4 & SECTION_MASK2,
        b,
        a
      );
    }
  }
}
function putBlockEntity(volume, x2, y, z, entity) {
  if (entity === void 0) volume.deleteBlockEntity(x2, y, z);
  else volume.setBlockEntity(x2, y, z, entity);
}
function applyCommand(volume, command) {
  forEachChange(command, (x2, y, z, _before, after) => volume.setIndex(x2, y, z, after));
  for (const c of command.blockEntities) putBlockEntity(volume, c.x, c.y, c.z, c.after);
}
function revertCommand(volume, command) {
  forEachChange(command, (x2, y, z, before) => volume.setIndex(x2, y, z, before));
  for (const c of command.blockEntities) putBlockEntity(volume, c.x, c.y, c.z, c.before);
}
var SectionStage = class {
  before = new Int32Array(SECTION_CELLS).fill(PENDING);
  after = new Int32Array(SECTION_CELLS);
  sx;
  sy;
  sz;
  constructor(sx, sy, sz) {
    this.sx = sx;
    this.sy = sy;
    this.sz = sz;
  }
};
var Staging = class {
  stages = /* @__PURE__ */ new Map();
  beStages = /* @__PURE__ */ new Map();
  last;
  /** The staged block entity change at a cell, if any. */
  blockEntityStage(x2, y, z) {
    if (this.beStages.size === 0) return void 0;
    return this.beStages.get(`${x2},${y},${z}`);
  }
  /** The first `before` and the last `after` of a cell win. */
  recordBlockEntity(x2, y, z, before, after) {
    const key2 = `${x2},${y},${z}`;
    const have = this.beStages.get(key2);
    if (have === void 0) this.beStages.set(key2, { before, after, x: x2, y, z });
    else have.after = after;
  }
  /** Does the staged value of this cell differ from what it was before? */
  isChanged(x2, y, z) {
    const stage = this.stages.get(`${x2 >> SECTION_BITS2},${y >> SECTION_BITS2},${z >> SECTION_BITS2}`);
    if (stage === void 0) return false;
    const i2 = localIndex(x2, y, z);
    return stage.before[i2] !== PENDING && stage.before[i2] !== stage.after[i2];
  }
  stageFor(x2, y, z) {
    const sx = x2 >> SECTION_BITS2;
    const sy = y >> SECTION_BITS2;
    const sz = z >> SECTION_BITS2;
    const last = this.last;
    if (last !== void 0 && last.sx === sx && last.sy === sy && last.sz === sz) return last;
    const key2 = `${sx},${sy},${sz}`;
    let stage = this.stages.get(key2);
    if (stage === void 0) {
      stage = new SectionStage(sx, sy, sz);
      this.stages.set(key2, stage);
    }
    this.last = stage;
    return stage;
  }
  /** The staged value at a cell, or `undefined` if it has not been touched. */
  peek(x2, y, z) {
    const sx = x2 >> SECTION_BITS2;
    const sy = y >> SECTION_BITS2;
    const sz = z >> SECTION_BITS2;
    let stage = this.last;
    if (stage === void 0 || stage.sx !== sx || stage.sy !== sy || stage.sz !== sz) {
      stage = this.stages.get(`${sx},${sy},${sz}`);
      if (stage === void 0) return void 0;
      this.last = stage;
    }
    const i2 = localIndex(x2, y, z);
    return stage.before[i2] === PENDING ? void 0 : stage.after[i2];
  }
  /** Visit every staged cell whose value changes, with its new value. */
  eachChanged(fn) {
    for (const st of this.stages.values()) {
      for (let i2 = 0; i2 < SECTION_CELLS; i2++) {
        const b = st.before[i2];
        if (b === PENDING) continue;
        fn(
          st.sx << SECTION_BITS2 | i2 & SECTION_MASK2,
          st.sy << SECTION_BITS2 | i2 >> 8,
          st.sz << SECTION_BITS2 | i2 >> 4 & SECTION_MASK2,
          st.after[i2]
        );
      }
    }
  }
  record(x2, y, z, before, after) {
    const stage = this.stageFor(x2, y, z);
    const i2 = localIndex(x2, y, z);
    if (stage.before[i2] === PENDING) stage.before[i2] = before;
    stage.after[i2] = after;
  }
  /** Freeze into a command, leaving out cells that end up unchanged. */
  toCommand(label) {
    const sparse = [];
    const diffs = [];
    let sparseCount = 0;
    for (const st of this.stages.values()) {
      const cells = [];
      for (let i2 = 0; i2 < SECTION_CELLS; i2++) {
        const b = st.before[i2];
        if (b === PENDING) continue;
        const a = st.after[i2];
        if (b === a) continue;
        cells.push(i2);
      }
      if (cells.length === 0) continue;
      if (cells.length * SPARSE_BYTES > DIFF_BYTES) {
        const before2 = new Int32Array(SECTION_CELLS).fill(UNSET);
        const after2 = new Int32Array(SECTION_CELLS).fill(UNSET);
        for (const i2 of cells) {
          before2[i2] = st.before[i2];
          after2[i2] = st.after[i2];
        }
        diffs.push({ sx: st.sx, sy: st.sy, sz: st.sz, before: before2, after: after2 });
      } else {
        sparse.push({ sx: st.sx, sy: st.sy, sz: st.sz, cells });
        sparseCount += cells.length;
      }
    }
    const positions = new Int32Array(sparseCount * 3);
    const before = new Int32Array(sparseCount);
    const after = new Int32Array(sparseCount);
    let n2 = 0;
    for (const { sx, sy, sz, cells } of sparse) {
      const st = this.stages.get(`${sx},${sy},${sz}`);
      for (const i2 of cells) {
        positions[3 * n2] = sx << SECTION_BITS2 | i2 & SECTION_MASK2;
        positions[3 * n2 + 1] = sy << SECTION_BITS2 | i2 >> 8;
        positions[3 * n2 + 2] = sz << SECTION_BITS2 | i2 >> 4 & SECTION_MASK2;
        before[n2] = st.before[i2];
        after[n2] = st.after[i2];
        n2++;
      }
    }
    const blockEntities = [];
    for (const e of this.beStages.values()) {
      if (e.before === void 0 && e.after === void 0) continue;
      if (e.before === e.after && !this.isChanged(e.x, e.y, e.z)) continue;
      blockEntities.push({ x: e.x, y: e.y, z: e.z, before: e.before, after: e.after });
    }
    return { label, positions, before, after, sections: diffs, blockEntities };
  }
};
function mergeCommands(label, commands) {
  const staging = new Staging();
  for (const c of commands) {
    forEachChange(c, (x2, y, z, before, after) => staging.record(x2, y, z, before, after));
    for (const e of c.blockEntities) staging.recordBlockEntity(e.x, e.y, e.z, e.before, e.after);
  }
  return staging.toCommand(label);
}
function checkCoordinate(axis, v) {
  if (!Number.isSafeInteger(v) || Math.abs(v) > 2147483647) {
    throw new EditError(`axis ${axis}: coordinate ${v} is not a 32-bit integer`);
  }
}
var hasNbt = (block) => block.includes("{");
var baseState = (block) => {
  const brace = block.indexOf("{");
  return brace === -1 ? block : block.slice(0, brace);
};
var CommandBuilder = class {
  staging = new Staging();
  maxExtent;
  volume;
  label;
  constructor(volume, label, options = {}) {
    this.volume = volume;
    this.label = label;
    this.maxExtent = options.maxExtent ?? MAX_EXTENT;
  }
  /** Palette index at a cell as it will be once the builder's writes are applied. */
  indexAt(x2, y, z) {
    return this.staging.peek(x2, y, z) ?? this.volume.indexAt(x2, y, z);
  }
  /** The block entity at a cell as it will be once the builder's writes are applied. */
  blockEntityAt(x2, y, z) {
    const staged = this.staging.blockEntityStage(x2, y, z);
    return staged === void 0 ? this.volume.blockEntityAt(x2, y, z) : staged.after;
  }
  /** Set a cell's block entity (or remove it with `undefined`). The cell must end up holding a block. */
  setBlockEntity(x2, y, z, entity) {
    checkCoordinate("x", x2);
    checkCoordinate("y", y);
    checkCoordinate("z", z);
    if (entity !== void 0 && this.indexAt(x2, y, z) === UNSET) {
      throw new EditError(`no block at ${x2}, ${y}, ${z} to attach a block entity to`);
    }
    this.staging.recordBlockEntity(x2, y, z, this.volume.blockEntityAt(x2, y, z), entity);
  }
  /**
   * Write a palette index (or {@link UNSET}) unconditionally. The cell keeps
   * its block entity if it holds a block of the same name afterwards, and
   * loses it otherwise.
   */
  setIndex(x2, y, z, index) {
    checkCoordinate("x", x2);
    checkCoordinate("y", y);
    checkCoordinate("z", z);
    if (index !== UNSET && this.volume.palette[index] === void 0) {
      throw new EditError(`palette index ${index} is not in the volume's palette`);
    }
    const prev = this.indexAt(x2, y, z);
    if (prev !== index && this.blockEntityAt(x2, y, z) !== void 0) {
      const keeps = index !== UNSET && prev !== UNSET && blockIdOf(this.volume.palette[prev]) === blockIdOf(this.volume.palette[index]);
      if (!keeps) this.setBlockEntity(x2, y, z, void 0);
    }
    this.staging.record(x2, y, z, this.volume.indexAt(x2, y, z), index);
  }
  /** Write a palette index together with exactly this block entity (or none). */
  setCell(x2, y, z, index, entity) {
    this.setIndex(x2, y, z, index);
    if (entity !== void 0 || this.blockEntityAt(x2, y, z) !== void 0) {
      this.setBlockEntity(x2, y, z, index === UNSET ? void 0 : entity);
    }
  }
  /** Write a block string, adding it to the palette. */
  setBlock(x2, y, z, block) {
    this.setIndex(x2, y, z, this.volume.intern(block));
  }
  /**
   * Place a block, keeping the block entity of a block that is already in
   * the same state: if the target has no NBT of its own and the cell holds
   * the same name and properties, nothing changes.
   */
  place(x2, y, z, index) {
    const current = this.indexAt(x2, y, z);
    if (current !== UNSET && current !== index) {
      const next = this.volume.palette[index];
      const old = this.volume.palette[current];
      if (!hasNbt(next) && baseState(old) === next) return;
    }
    this.setIndex(x2, y, z, index);
  }
  /** Make a cell unset. */
  unset(x2, y, z) {
    this.setIndex(x2, y, z, UNSET);
  }
  /**
   * Freeze the recorded edits. Throws {@link EditError} if they would grow
   * the volume past the size limit on an axis (a volume that is already
   * larger may keep its size but not grow further).
   */
  finish() {
    const command = this.staging.toCommand(this.label);
    if (!isEmptyCommand(command)) this.checkGrowth(command);
    return command;
  }
  checkGrowth(command) {
    let grows = false;
    forEachChange(command, (_x, _y, _z, before, after) => {
      if (before === UNSET && after !== UNSET) grows = true;
    });
    if (!grows) return;
    const now = this.volume.placedBounds();
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    const note = (x2, y, z) => {
      if (x2 < lo[0]) lo[0] = x2;
      if (y < lo[1]) lo[1] = y;
      if (z < lo[2]) lo[2] = z;
      if (x2 > hi[0]) hi[0] = x2;
      if (y > hi[1]) hi[1] = y;
      if (z > hi[2]) hi[2] = z;
    };
    let shrinks = false;
    this.staging.eachChanged((x2, y, z, after) => {
      if (after !== UNSET) {
        note(x2, y, z);
      } else if (now !== null && this.volume.indexAt(x2, y, z) !== UNSET && (x2 === now[0][0] || x2 === now[1][0] || y === now[0][1] || y === now[1][1] || z === now[0][2] || z === now[1][2])) {
        shrinks = true;
      }
    });
    if (shrinks) {
      lo.fill(Infinity);
      hi.fill(-Infinity);
      this.staging.eachChanged((x2, y, z, after) => {
        if (after !== UNSET) note(x2, y, z);
      });
      this.volume.eachCell((x2, y, z) => {
        if (this.staging.peek(x2, y, z) === void 0) note(x2, y, z);
      });
    } else if (now !== null) {
      note(now[0][0], now[0][1], now[0][2]);
      note(now[1][0], now[1][1], now[1][2]);
    }
    const names = ["x", "y", "z"];
    for (let a = 0; a < 3; a++) {
      const next = hi[a] - lo[a] + 1;
      if (next <= this.maxExtent) continue;
      const before = now === null ? 0 : now[1][a] - now[0][a] + 1;
      if (next > before) {
        throw new EditError(
          `this edit would make the volume ${next} blocks long along ${names[a]}; the limit is ${this.maxExtent}`
        );
      }
    }
  }
};

// packages/core/src/edit/blockstate.ts
var BOOLEAN = ["true", "false"];
var CARDINAL = ["north", "east", "south", "west"];
var SIX_FACES = ["north", "east", "south", "west", "up", "down"];
var range = (n2) => Array.from({ length: n2 }, (_, i2) => String(i2));
var KNOWN = {
  axis: [["x", "y", "z"]],
  facing: [CARDINAL, SIX_FACES],
  half: [
    ["top", "bottom"],
    ["upper", "lower"]
  ],
  type: [
    ["top", "bottom", "double"],
    ["single", "left", "right"],
    ["normal", "sticky"]
  ],
  shape: [
    ["straight", "inner_left", "inner_right", "outer_left", "outer_right"],
    [
      "north_south",
      "east_west",
      "ascending_east",
      "ascending_west",
      "ascending_north",
      "ascending_south",
      "south_east",
      "south_west",
      "north_west",
      "north_east"
    ]
  ],
  hinge: [["left", "right"]],
  part: [["head", "foot"]],
  face: [["floor", "wall", "ceiling"]],
  attachment: [["floor", "ceiling", "single_wall", "double_wall"]],
  mode: [["compare", "subtract"]],
  north: [
    ["none", "low", "tall"],
    ["up", "side", "none"]
  ],
  east: [
    ["none", "low", "tall"],
    ["up", "side", "none"]
  ],
  south: [
    ["none", "low", "tall"],
    ["up", "side", "none"]
  ],
  west: [
    ["none", "low", "tall"],
    ["up", "side", "none"]
  ],
  rotation: [range(16)],
  power: [range(16)]
};
function optionsFor(key2, value) {
  if (BOOLEAN.includes(value)) return { options: BOOLEAN, exact: true };
  const sets = Object.hasOwn(KNOWN, key2) ? KNOWN[key2] : [];
  const set2 = sets.find((s) => s.includes(value));
  return set2 === void 0 ? { options: null, exact: false } : { options: set2, exact: false };
}
function blockProperties(state) {
  const { props } = parse(state);
  return [...props].map(([key2, value]) => ({ key: key2, value, ...optionsFor(key2, value) }));
}
var TOKEN = /^[a-z0-9_]+$/;
function withBlockProperty(state, key2, value) {
  if (!TOKEN.test(key2)) throw new EditError(`invalid property name '${key2}'`);
  if (!TOKEN.test(value)) throw new EditError(`invalid value '${value}' for property '${key2}'`);
  const { name, props, nbt } = parse(state);
  const next = new Map(props);
  next.set(key2, value);
  return join(name, next, nbt ?? "");
}
function setBlockProperty(volume, pos, key2, value) {
  const idx = volume.indexAt(pos[0], pos[1], pos[2]);
  if (idx === UNSET) throw new EditError(`no block at ${pos.join(", ")} to edit`);
  const b = new CommandBuilder(volume, `set ${key2}=${value}`);
  b.setBlock(pos[0], pos[1], pos[2], withBlockProperty(volume.palette[idx], key2, value));
  return b.finish();
}

// packages/core/src/edit/box.ts
function makeBox(a, b) {
  return {
    min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
    max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])]
  };
}
function boxSize(box2) {
  return [box2.max[0] - box2.min[0] + 1, box2.max[1] - box2.min[1] + 1, box2.max[2] - box2.min[2] + 1];
}
function boxCellCount(box2) {
  const [w, h, l] = boxSize(box2);
  return w * h * l;
}
function boxContains(box2, x2, y, z) {
  return x2 >= box2.min[0] && x2 <= box2.max[0] && y >= box2.min[1] && y <= box2.max[1] && z >= box2.min[2] && z <= box2.max[2];
}
function eachPosInBox(box2, fn) {
  for (let x2 = box2.min[0]; x2 <= box2.max[0]; x2++) {
    for (let y = box2.min[1]; y <= box2.max[1]; y++) {
      for (let z = box2.min[2]; z <= box2.max[2]; z++) fn(x2, y, z);
    }
  }
}
function eachCellInBox(volume, box2, fn) {
  if (boxCellCount(box2) <= volume.size * 8 + 4096) {
    eachPosInBox(box2, (x2, y, z) => {
      const idx = volume.indexAt(x2, y, z);
      if (idx >= 0) fn(x2, y, z, idx);
    });
    return;
  }
  const hits = [];
  volume.eachCell((x2, y, z, idx) => {
    if (boxContains(box2, x2, y, z)) hits.push(x2, y, z, idx);
  });
  for (let i2 = 0; i2 < hits.length; i2 += 4) {
    fn(hits[i2], hits[i2 + 1], hits[i2 + 2], hits[i2 + 3]);
  }
}

// packages/core/src/edit/dirty.ts
var sectionKey2 = (sx, sy, sz) => `${sx},${sy},${sz}`;
function parseSectionKey(key2) {
  const parts = key2.split(",").map(Number);
  if (parts.length !== 3 || parts.some((n2) => !Number.isInteger(n2))) {
    throw new Error(`malformed section key '${key2}'`);
  }
  return [parts[0], parts[1], parts[2]];
}
function offsets(local) {
  if (local === 0) return [0, -1];
  if (local === 15) return [0, 1];
  return [0];
}
function markBlockDirty(into, x2, y, z) {
  const sx = x2 >> 4;
  const sy = y >> 4;
  const sz = z >> 4;
  for (const dx of offsets(x2 & 15)) {
    for (const dy of offsets(y & 15)) {
      for (const dz of offsets(z & 15)) into.add(sectionKey2(sx + dx, sy + dy, sz + dz));
    }
  }
}
function dirtySectionKeys(command, into = /* @__PURE__ */ new Set()) {
  forEachChange(command, (x2, y, z) => markBlockDirty(into, x2, y, z));
  return into;
}
var DirtyTracker = class {
  keys = /* @__PURE__ */ new Set();
  get size() {
    return this.keys.size;
  }
  has(key2) {
    return this.keys.has(key2);
  }
  markCommand(command) {
    dirtySectionKeys(command, this.keys);
  }
  markSection(sx, sy, sz) {
    this.keys.add(sectionKey2(sx, sy, sz));
  }
  /** Return the dirty keys and start empty. */
  take() {
    const out = [...this.keys];
    this.keys = /* @__PURE__ */ new Set();
    return out;
  }
};

// packages/core/src/edit/history.ts
var DEFAULT_HISTORY_BYTES = 64 * 1024 * 1024;
var History = class {
  maxBytes;
  undoStack = [];
  redoStack = [];
  total = 0;
  constructor(options = {}) {
    this.maxBytes = options.maxBytes ?? DEFAULT_HISTORY_BYTES;
  }
  get undoCount() {
    return this.undoStack.length;
  }
  get redoCount() {
    return this.redoStack.length;
  }
  /** Bytes held by both stacks. */
  get bytes() {
    return this.total;
  }
  get canUndo() {
    return this.undoStack.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }
  /** Labels of the undo stack, oldest first. */
  get undoLabels() {
    return this.undoStack.map((e) => e.command.label);
  }
  /**
   * Record a command that has already been applied. Clears the redo stack.
   * Returns how many old entries were dropped to stay in budget.
   */
  push(command) {
    for (const e of this.redoStack) this.total -= e.bytes;
    this.redoStack = [];
    const bytes = commandBytes(command);
    this.undoStack.push({ command, bytes });
    this.total += bytes;
    let drop = 0;
    while (this.total > this.maxBytes && drop < this.undoStack.length - 1) {
      this.total -= this.undoStack[drop].bytes;
      drop++;
    }
    if (drop > 0) this.undoStack.splice(0, drop);
    return drop;
  }
  /** Revert the latest command on `volume`. Returns it, or `null` if there is nothing to undo. */
  undo(volume) {
    const entry = this.undoStack.pop();
    if (entry === void 0) return null;
    revertCommand(volume, entry.command);
    this.redoStack.push(entry);
    return entry.command;
  }
  /** Re-apply the latest undone command. Returns it, or `null` if there is nothing to redo. */
  redo(volume) {
    const entry = this.redoStack.pop();
    if (entry === void 0) return null;
    applyCommand(volume, entry.command);
    this.undoStack.push(entry);
    return entry.command;
  }
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.total = 0;
  }
};

// packages/core/src/edit/editor.ts
var Stroke = class {
  applied = [];
  open = true;
  editor;
  label;
  constructor(editor, label) {
    this.editor = editor;
    this.label = label;
  }
  /** Apply a tool's command now. Build each one from the editor's current volume. */
  apply(command) {
    this.assertOpen();
    if (isEmptyCommand(command)) return;
    applyCommand(this.editor.volume, command);
    this.editor.dirty.markCommand(command);
    this.applied.push(command);
  }
  /** End the stroke and record it as one history entry. Returns false if it changed nothing. */
  commit() {
    this.assertOpen();
    this.open = false;
    const merged = mergeCommands(this.label, this.applied);
    if (isEmptyCommand(merged)) return false;
    this.editor.history.push(merged);
    return true;
  }
  /** End the stroke and undo everything it did. */
  cancel() {
    this.assertOpen();
    this.open = false;
    for (let i2 = this.applied.length - 1; i2 >= 0; i2--) {
      const c = this.applied[i2];
      revertCommand(this.editor.volume, c);
      this.editor.dirty.markCommand(c);
    }
  }
  assertOpen() {
    if (!this.open) throw new Error("stroke is already finished");
  }
};
var Editor = class {
  history;
  dirty = new DirtyTracker();
  clipboard = null;
  volume;
  constructor(volume, options = {}) {
    this.volume = volume;
    this.history = new History(options);
  }
  /** Apply a command, record it for undo and mark its sections dirty. Returns false if it was empty. */
  run(command) {
    if (isEmptyCommand(command)) return false;
    applyCommand(this.volume, command);
    this.dirty.markCommand(command);
    this.history.push(command);
    return true;
  }
  /** Begin a drag; see {@link Stroke}. */
  beginStroke(label) {
    return new Stroke(this, label);
  }
  undo() {
    const c = this.history.undo(this.volume);
    if (c === null) return false;
    this.dirty.markCommand(c);
    return true;
  }
  redo() {
    const c = this.history.redo(this.volume);
    if (c === null) return false;
    this.dirty.markCommand(c);
    return true;
  }
};

// packages/core/src/edit/pick.ts
function raycast(volume, origin, direction2, options = {}) {
  const maxDistance = options.maxDistance ?? 256;
  if (![...origin, ...direction2].every(Number.isFinite)) {
    throw new EditError("ray origin and direction must be finite");
  }
  const len = Math.hypot(direction2[0], direction2[1], direction2[2]);
  if (len === 0) throw new EditError("ray direction must not be zero");
  const dx = direction2[0] / len;
  const dy = direction2[1] / len;
  const dz = direction2[2] / len;
  let x2 = Math.floor(origin[0]);
  let y = Math.floor(origin[1]);
  let z = Math.floor(origin[2]);
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const stepZ = dz > 0 ? 1 : -1;
  const tDeltaX = dx === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dx);
  const tDeltaY = dy === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dy);
  const tDeltaZ = dz === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dz);
  let tMaxX = dx === 0 ? Number.POSITIVE_INFINITY : (dx > 0 ? x2 + 1 - origin[0] : origin[0] - x2) * tDeltaX;
  let tMaxY = dy === 0 ? Number.POSITIVE_INFINITY : (dy > 0 ? y + 1 - origin[1] : origin[1] - y) * tDeltaY;
  let tMaxZ = dz === 0 ? Number.POSITIVE_INFINITY : (dz > 0 ? z + 1 - origin[2] : origin[2] - z) * tDeltaZ;
  const accept = options.accept;
  const solid = (cx, cy, cz) => {
    if (accept !== void 0 && !accept(cx, cy, cz)) return null;
    const block = volume.get(cx, cy, cz);
    return block === void 0 || AIR_BLOCKS.has(block) ? null : block;
  };
  const start = solid(x2, y, z);
  if (start !== null) {
    return {
      position: [x2, y, z],
      normal: [0, 0, 0],
      adjacent: [x2, y, z],
      distance: 0,
      block: start
    };
  }
  for (; ; ) {
    let t;
    let normal;
    if (tMaxX <= tMaxY && tMaxX <= tMaxZ) {
      t = tMaxX;
      x2 += stepX;
      tMaxX += tDeltaX;
      normal = [0 - stepX, 0, 0];
    } else if (tMaxY <= tMaxZ) {
      t = tMaxY;
      y += stepY;
      tMaxY += tDeltaY;
      normal = [0, 0 - stepY, 0];
    } else {
      t = tMaxZ;
      z += stepZ;
      tMaxZ += tDeltaZ;
      normal = [0, 0, 0 - stepZ];
    }
    if (t > maxDistance) return null;
    const block = solid(x2, y, z);
    if (block !== null) {
      return {
        position: [x2, y, z],
        normal,
        adjacent: [x2 + normal[0], y + normal[1], z + normal[2]],
        distance: t,
        block
      };
    }
  }
}

// packages/core/src/rotation/rotation.ts
var ROTATIONS = ["NONE", "CLOCKWISE_90", "CLOCKWISE_180", "COUNTERCLOCKWISE_90"];
var RotationError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "RotationError";
  }
};
var FACING_CW90 = { north: "east", east: "south", south: "west", west: "north" };
var FACING_CCW90 = { east: "north", south: "east", west: "south", north: "west" };
var FACING_180 = { north: "south", south: "north", east: "west", west: "east" };
var CARDINALS = ["north", "east", "south", "west"];
var own = (map, key2) => key2 !== void 0 && Object.hasOwn(map, key2) ? map[key2] : void 0;
function checkRotation(rotation) {
  if (!ROTATIONS.includes(rotation)) {
    throw new RotationError(
      `invalid rotation '${rotation}'; expected one of [${ROTATIONS.map((r) => `'${r}'`).join(", ")}]`
    );
  }
  return rotation;
}
function rotatePoint(x2, z, ax, az, rotation) {
  checkRotation(rotation);
  let rx = x2 - ax;
  let rz = z - az;
  if (rotation === "CLOCKWISE_90") [rx, rz] = [-rz, rx];
  else if (rotation === "COUNTERCLOCKWISE_90") [rx, rz] = [rz, -rx];
  else if (rotation === "CLOCKWISE_180") [rx, rz] = [-rx, -rz];
  return [ax + rx + 0, az + rz + 0];
}
function rotatePosition(x2, z, size, rotation) {
  checkRotation(rotation);
  if (rotation === "NONE") return [x2, z];
  if (rotation === "CLOCKWISE_90") return [size - 1 - z, x2];
  if (rotation === "CLOCKWISE_180") return [size - 1 - x2, size - 1 - z];
  return [z, size - 1 - x2];
}
function facingMap(rotation) {
  if (rotation === "CLOCKWISE_90") return FACING_CW90;
  if (rotation === "COUNTERCLOCKWISE_90") return FACING_CCW90;
  if (rotation === "CLOCKWISE_180") return FACING_180;
  return null;
}
function permuteCardinalKeys(props, map) {
  const remapped = /* @__PURE__ */ new Map();
  for (const key2 of CARDINALS) {
    const v = props.get(key2);
    if (v !== void 0) remapped.set(map[key2] ?? key2, v);
  }
  for (const key2 of CARDINALS) props.delete(key2);
  for (const [k, v] of remapped) props.set(k, v);
}
function remapOrientation(props, map) {
  const ori = props.get("orientation");
  if (ori === void 0) return;
  const cut = ori.indexOf("_");
  const head = cut === -1 ? ori : ori.slice(0, cut);
  const tail = cut === -1 ? "" : ori.slice(cut);
  const next = own(map, head);
  if (next !== void 0) props.set("orientation", next + tail);
}
function remapProps(input, rotation) {
  const out = new Map(input);
  const map = facingMap(rotation);
  if (map !== null) {
    const next = own(map, out.get("facing"));
    if (next !== void 0) out.set("facing", next);
    permuteCardinalKeys(out, map);
    remapOrientation(out, map);
  }
  if (rotation === "CLOCKWISE_90" || rotation === "COUNTERCLOCKWISE_90") {
    const axis = out.get("axis");
    if (axis === "x") out.set("axis", "z");
    else if (axis === "z") out.set("axis", "x");
  }
  const rot = out.get("rotation");
  if (rot !== void 0 && /^-*[0-9]+$/.test(rot)) {
    const shift = { CLOCKWISE_90: 4, CLOCKWISE_180: 8, COUNTERCLOCKWISE_90: 12, NONE: 0 }[rotation];
    out.set("rotation", String(((Number.parseInt(rot, 10) + shift) % 16 + 16) % 16));
  }
  return out;
}
function split(canonical2) {
  let head = canonical2;
  let nbt = "";
  const brace = head.indexOf("{");
  if (brace !== -1) {
    nbt = head.slice(brace);
    head = head.slice(0, brace);
  }
  const props = /* @__PURE__ */ new Map();
  let name = head;
  const open = head.indexOf("[");
  const close = open === -1 ? -1 : head.indexOf("]", open);
  if (open !== -1 && close !== -1) {
    name = head.slice(0, open);
    for (const raw of head.slice(open + 1, close).split(",")) {
      const item = raw.trim();
      if (item === "") continue;
      const eq = item.indexOf("=");
      const key2 = (eq === -1 ? item : item.slice(0, eq)).trim();
      const value = eq === -1 ? "" : item.slice(eq + 1).trim();
      props.set(key2, value);
    }
  }
  return { name, props, nbt };
}
function rejoin(name, props, nbt) {
  const built = props.size > 0 ? join(name, props, nbt) : name + nbt;
  return canonicalize(built);
}
function rotateBlockstate(canonical2, rotation) {
  checkRotation(rotation);
  if (rotation === "NONE") return canonicalize(canonical2);
  const { name, props, nbt } = split(canonical2);
  if (props.size === 0) return canonicalize(canonical2);
  return rejoin(name, remapProps(props, rotation), nbt);
}
var MIRROR_FACING = {
  x: { east: "west", west: "east" },
  z: { north: "south", south: "north" }
};
function mirrorBlockstate(canonical2, axis) {
  if (axis !== "x" && axis !== "z") {
    throw new RotationError(`invalid mirror axis '${String(axis)}'; expected 'x' or 'z'`);
  }
  const { name, props, nbt } = split(canonical2);
  if (props.size === 0) return canonicalize(canonical2);
  const swap = MIRROR_FACING[axis];
  const out = new Map(props);
  const next = own(swap, out.get("facing"));
  if (next !== void 0) out.set("facing", next);
  permuteCardinalKeys(out, swap);
  remapOrientation(out, swap);
  return rejoin(name, out, nbt);
}

// packages/core/src/edit/selection.ts
function clipboardCellCount(clip) {
  return clip.indices.length;
}
function copySelection(volume, box2) {
  const palette = [];
  const remap2 = /* @__PURE__ */ new Map();
  const offsets2 = [];
  const indices = [];
  const blockEntities = /* @__PURE__ */ new Map();
  eachCellInBox(volume, box2, (x2, y, z, idx) => {
    let local = remap2.get(idx);
    if (local === void 0) {
      local = palette.length;
      palette.push(volume.palette[idx]);
      remap2.set(idx, local);
    }
    const entity = volume.blockEntityAt(x2, y, z);
    if (entity !== void 0) {
      blockEntities.set(indices.length, { edition: entity.edition, nbt: cloneNbt(entity.nbt) });
    }
    offsets2.push(x2 - box2.min[0], y - box2.min[1], z - box2.min[2]);
    indices.push(local);
  });
  return {
    size: boxSize(box2),
    palette,
    offsets: Int32Array.from(offsets2),
    indices: Int32Array.from(indices),
    blockEntities
  };
}
function pasteClipboard(volume, clip, at, options = {}) {
  if (!at.every(Number.isInteger))
    throw new EditError("paste position must be integer coordinates");
  const b = new CommandBuilder(volume, "paste");
  const mapped = clip.palette.map(
    (p) => options.skipAir === true && AIR_BLOCKS.has(baseState(p)) ? UNSET : volume.intern(p)
  );
  for (let i2 = 0; i2 < clip.indices.length; i2++) {
    const idx = mapped[clip.indices[i2]];
    if (idx === UNSET) continue;
    const x2 = at[0] + clip.offsets[3 * i2];
    const y = at[1] + clip.offsets[3 * i2 + 1];
    const z = at[2] + clip.offsets[3 * i2 + 2];
    b.place(x2, y, z, idx);
    const entity = clip.blockEntities.get(i2);
    b.setBlockEntity(
      x2,
      y,
      z,
      entity === void 0 ? void 0 : { edition: entity.edition, nbt: cloneNbt(entity.nbt) }
    );
  }
  return b.finish();
}
function moveSelection(volume, box2, delta, options = {}) {
  if (!delta.every(Number.isInteger))
    throw new EditError("move offset must be integer coordinates");
  const b = new CommandBuilder(volume, "move");
  if (delta[0] === 0 && delta[1] === 0 && delta[2] === 0) return b.finish();
  const moved = [];
  const carried = [];
  eachCellInBox(volume, box2, (x2, y, z, idx) => {
    moved.push(x2, y, z, idx);
    carried.push(volume.blockEntityAt(x2, y, z));
  });
  for (let i2 = 0; i2 < moved.length; i2 += 4) {
    b.unset(moved[i2], moved[i2 + 1], moved[i2 + 2]);
  }
  for (let i2 = 0; i2 < moved.length; i2 += 4) {
    const idx = moved[i2 + 3];
    if (options.skipAir === true && AIR_BLOCKS.has(baseState(volume.palette[idx])))
      continue;
    b.setCell(
      moved[i2] + delta[0],
      moved[i2 + 1] + delta[1],
      moved[i2 + 2] + delta[2],
      idx,
      carried[i2 / 4]
    );
  }
  return b.finish();
}
function rotatedBox(box2, rotation) {
  const [w, h, l] = boxSize(box2);
  const quarter = rotation === "CLOCKWISE_90" || rotation === "COUNTERCLOCKWISE_90";
  return {
    min: box2.min,
    max: [
      box2.min[0] + (quarter ? l : w) - 1,
      box2.min[1] + h - 1,
      box2.min[2] + (quarter ? w : l) - 1
    ]
  };
}
function rotateSelection(volume, box2, rotation, options = {}) {
  const b = new CommandBuilder(volume, `rotate ${rotation}`);
  const [w, , l] = boxSize(box2);
  const s = Math.max(w, l);
  const corners2 = [
    rotatePosition(0, 0, s, rotation),
    rotatePosition(w - 1, 0, s, rotation),
    rotatePosition(0, l - 1, s, rotation),
    rotatePosition(w - 1, l - 1, s, rotation)
  ];
  const shiftX = Math.min(...corners2.map((c) => c[0]));
  const shiftZ = Math.min(...corners2.map((c) => c[1]));
  return transformSelection(
    volume,
    box2,
    b,
    (lx, lz) => {
      const [rx, rz] = rotatePosition(lx, lz, s, rotation);
      return [rx - shiftX, rz - shiftZ];
    },
    (block) => rotateBlockstate(block, rotation),
    options.skipAir === true
  );
}
function mirrorSelection(volume, box2, axis) {
  if (axis !== "x" && axis !== "z") throw new EditError(`invalid mirror axis '${String(axis)}'`);
  const [w, , l] = boxSize(box2);
  const b = new CommandBuilder(volume, `mirror ${axis}`);
  return transformSelection(
    volume,
    box2,
    b,
    (lx, lz) => [axis === "x" ? w - 1 - lx : lx, axis === "z" ? l - 1 - lz : lz],
    (block) => mirrorBlockstate(block, axis)
  );
}
function transformSelection(volume, box2, b, movePos, mapBlock, skipAir = false) {
  const cells = [];
  const carried = [];
  eachCellInBox(volume, box2, (x2, y, z, idx) => {
    cells.push(x2, y, z, idx);
    carried.push(volume.blockEntityAt(x2, y, z));
  });
  for (let i2 = 0; i2 < cells.length; i2 += 4) {
    b.unset(cells[i2], cells[i2 + 1], cells[i2 + 2]);
  }
  const mapped = /* @__PURE__ */ new Map();
  for (let i2 = 0; i2 < cells.length; i2 += 4) {
    const idx = cells[i2 + 3];
    if (skipAir && AIR_BLOCKS.has(baseState(volume.palette[idx]))) continue;
    let next = mapped.get(idx);
    if (next === void 0) {
      next = volume.intern(mapBlock(volume.palette[idx]));
      mapped.set(idx, next);
    }
    const [nx, nz] = movePos(
      cells[i2] - box2.min[0],
      cells[i2 + 2] - box2.min[2]
    );
    b.setCell(box2.min[0] + nx, cells[i2 + 1], box2.min[2] + nz, next, carried[i2 / 4]);
  }
  return b.finish();
}

// packages/core/src/edit/tools.ts
function checkInt(what, p) {
  if (!p.every(Number.isInteger)) throw new EditError(`${what} must be integer coordinates`);
}
function isEmptyBlock(block) {
  return block === void 0 || AIR_BLOCKS.has(baseState(block));
}
function placeBlock(volume, pos, block) {
  return placeCells(volume, [pos], block, "place");
}
function placeCells(volume, cells, block, label = "place") {
  const b = new CommandBuilder(volume, label);
  const idx = volume.intern(canonicalize(block));
  for (const p of cells) {
    checkInt("position", p);
    b.place(p[0], p[1], p[2], idx);
  }
  return b.finish();
}
function eraseBlock(volume, pos, options = {}) {
  return eraseCells(volume, [pos], options, "erase");
}
function eraseCells(volume, cells, options = {}, label = "erase") {
  const b = new CommandBuilder(volume, label);
  const air = options.toAir === true ? volume.intern("minecraft:air") : UNSET;
  for (const p of cells) {
    checkInt("position", p);
    if (b.indexAt(p[0], p[1], p[2]) === UNSET && air !== UNSET) continue;
    b.setIndex(p[0], p[1], p[2], air);
  }
  return b.finish();
}
function linePoints(a, b) {
  checkInt("line end", a);
  checkInt("line end", b);
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const n2 = Math.max(Math.abs(d[0]), Math.abs(d[1]), Math.abs(d[2]));
  if (n2 === 0) return [[a[0], a[1], a[2]]];
  const step = [Math.sign(d[0]), Math.sign(d[1]), Math.sign(d[2])];
  const abs = [Math.abs(d[0]), Math.abs(d[1]), Math.abs(d[2])];
  const err2 = [Math.floor(n2 / 2), Math.floor(n2 / 2), Math.floor(n2 / 2)];
  const cur = [a[0], a[1], a[2]];
  const out = [[cur[0], cur[1], cur[2]]];
  for (let i2 = 0; i2 < n2; i2++) {
    for (let k = 0; k < 3; k++) {
      err2[k] = err2[k] - abs[k];
      if (err2[k] < 0) {
        cur[k] = cur[k] + step[k];
        err2[k] = err2[k] + n2;
      }
    }
    out.push([cur[0], cur[1], cur[2]]);
  }
  return out;
}
function drawLine(volume, a, b, block) {
  return placeCells(volume, linePoints(a, b), block, "line");
}
var AXES = ["x", "y", "z"];
function drawRectangle(volume, a, b, block, options = {}) {
  checkInt("rectangle corner", a);
  checkInt("rectangle corner", b);
  const normal = options.normal ?? AXES.find((_, i2) => a[i2] === b[i2]) ?? "y";
  const n2 = AXES.indexOf(normal);
  const lo = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])];
  const hi = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])];
  lo[n2] = a[n2];
  hi[n2] = a[n2];
  const box2 = makeBox(lo, hi);
  const [u, v] = [0, 1, 2].filter((i2) => i2 !== n2);
  const cells = [];
  eachPosInBox(box2, (x2, y, z) => {
    const p = [x2, y, z];
    if (options.hollow === true && p[u] !== lo[u] && p[u] !== hi[u] && p[v] !== lo[v] && p[v] !== hi[v]) {
      return;
    }
    cells.push([x2, y, z]);
  });
  return placeCells(
    volume,
    cells,
    block,
    options.hollow === true ? "hollow rectangle" : "rectangle"
  );
}
function drawBox(volume, a, b, block, options = {}) {
  checkInt("box corner", a);
  checkInt("box corner", b);
  const box2 = makeBox(a, b);
  const label = options.hollow === true ? "hollow box" : "box";
  const b22 = new CommandBuilder(volume, label);
  const idx = volume.intern(canonicalize(block));
  eachPosInBox(box2, (x2, y, z) => {
    if (options.hollow === true && x2 !== box2.min[0] && x2 !== box2.max[0] && y !== box2.min[1] && y !== box2.max[1] && z !== box2.min[2] && z !== box2.max[2]) {
      return;
    }
    b22.place(x2, y, z, idx);
  });
  return b22.finish();
}
function fillSelection(volume, box2, block, options = {}) {
  const b = new CommandBuilder(volume, "fill");
  const idx = volume.intern(canonicalize(block));
  eachPosInBox(box2, (x2, y, z) => {
    if (options.onlyEmpty === true) {
      const cur = b.indexAt(x2, y, z);
      if (!isEmptyBlock(cur === UNSET ? void 0 : volume.palette[cur])) return;
    }
    b.place(x2, y, z, idx);
  });
  return b.finish();
}
function replaceInSelection(volume, box2, from, to) {
  const wanted = canonicalize(from);
  const wantsExact = wanted.includes("{");
  const b = new CommandBuilder(volume, "replace");
  const idx = volume.intern(canonicalize(to));
  eachCellInBox(volume, box2, (x2, y, z, cur) => {
    const block = volume.palette[cur];
    if (wantsExact ? block === wanted : baseState(block) === wanted) b.place(x2, y, z, idx);
  });
  return b.finish();
}

// packages/core/src/edit/util.ts
function cloneVolume(source) {
  const copy = new Volume();
  for (const block of source.palette) copy.intern(block);
  source.eachCell((x2, y, z, idx) => copy.setIndex(x2, y, z, idx));
  source.eachBlockEntity(
    (x2, y, z, e) => copy.setBlockEntity(x2, y, z, { edition: e.edition, nbt: cloneNbt(e.nbt) })
  );
  for (const e of source.entities) copy.addEntity({ edition: e.edition, nbt: cloneNbt(e.nbt) });
  return copy;
}

// packages/render/src/image.ts
function newImage(width, height, rgb) {
  const data = new Uint8Array(width * height * 3);
  for (let i2 = 0; i2 < width * height; i2++) data.set(rgb, i2 * 3);
  return { width, height, channels: 3, data };
}
function fromRgba(width, height, rgba) {
  let opaque = true;
  for (let i2 = 3; i2 < rgba.length; i2 += 4) {
    if (rgba[i2] !== 255) {
      opaque = false;
      break;
    }
  }
  if (!opaque) return { width, height, channels: 4, data: rgba };
  const data = new Uint8Array(width * height * 3);
  for (let i2 = 0; i2 < width * height; i2++) {
    data[i2 * 3] = rgba[i2 * 4];
    data[i2 * 3 + 1] = rgba[i2 * 4 + 1];
    data[i2 * 3 + 2] = rgba[i2 * 4 + 2];
  }
  return { width, height, channels: 3, data };
}
function crop(img, left, top, right, bottom) {
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  const c = img.channels;
  const data = new Uint8Array(width * height * c);
  for (let y = 0; y < height; y++) {
    const sy = top + y;
    if (sy < 0 || sy >= img.height) continue;
    for (let x2 = 0; x2 < width; x2++) {
      const sx = left + x2;
      if (sx < 0 || sx >= img.width) continue;
      const s = (sy * img.width + sx) * c;
      const d = (y * width + x2) * c;
      for (let k = 0; k < c; k++) data[d + k] = img.data[s + k];
    }
  }
  return { width, height, channels: c, data };
}
function remap(img, width, height, from) {
  const c = img.channels;
  const data = new Uint8Array(width * height * c);
  for (let y = 0; y < height; y++) {
    for (let x2 = 0; x2 < width; x2++) {
      const [sx, sy] = from(x2, y);
      const s = (sy * img.width + sx) * c;
      const d = (y * width + x2) * c;
      for (let k = 0; k < c; k++) data[d + k] = img.data[s + k];
    }
  }
  return { width, height, channels: c, data };
}
var flipLeftRight = (img) => remap(img, img.width, img.height, (x2, y) => [img.width - 1 - x2, y]);
var flipTopBottom = (img) => remap(img, img.width, img.height, (x2, y) => [x2, img.height - 1 - y]);
var rotate90Ccw = (img) => remap(img, img.height, img.width, (x2, y) => [img.width - 1 - y, x2]);
var rotate90Cw = (img) => remap(img, img.height, img.width, (x2, y) => [y, img.height - 1 - x2]);
var rotate180 = (img) => remap(img, img.width, img.height, (x2, y) => [img.width - 1 - x2, img.height - 1 - y]);
function scaleChannels(img, factors) {
  const c = img.channels;
  const data = new Uint8Array(img.data);
  for (let i2 = 0; i2 < img.width * img.height; i2++) {
    for (let k = 0; k < 3; k++) {
      data[i2 * c + k] = Math.min(
        255,
        Math.trunc(img.data[i2 * c + k] * factors[k])
      );
    }
  }
  return { ...img, data };
}
function shade(img, factor) {
  return factor >= 1 ? img : scaleChannels(img, [factor, factor, factor]);
}
function tint(img, rgb) {
  return scaleChannels(img, [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255]);
}
var copyImage = (img) => ({
  ...img,
  data: new Uint8Array(img.data)
});
function getPixel(img, x2, y) {
  const i2 = (y * img.width + x2) * img.channels;
  return [
    img.data[i2],
    img.data[i2 + 1],
    img.data[i2 + 2],
    img.channels === 4 ? img.data[i2 + 3] : 255
  ];
}
function setPixel(img, x2, y, rgba) {
  const i2 = (y * img.width + x2) * img.channels;
  img.data[i2] = rgba[0];
  img.data[i2 + 1] = rgba[1];
  img.data[i2 + 2] = rgba[2];
  if (img.channels === 4) img.data[i2 + 3] = rgba[3];
}
function paste(dst, src, left, top) {
  for (let y = 0; y < src.height; y++) {
    for (let x2 = 0; x2 < src.width; x2++) {
      const dx = left + x2;
      const dy = top + y;
      if (dx < 0 || dy < 0 || dx >= dst.width || dy >= dst.height) continue;
      setPixel(dst, dx, dy, getPixel(src, x2, y));
    }
  }
}
function tintRgb(img, rgb) {
  const c = img.channels;
  const data = new Uint8Array(img.data);
  for (let i2 = 0; i2 < img.width * img.height; i2++) {
    for (let k = 0; k < 3; k++)
      data[i2 * c + k] = Math.floor(img.data[i2 * c + k] * rgb[k] / 255);
  }
  return { ...img, data };
}
function solidRgba(width, height, rgba) {
  const data = new Uint8Array(width * height * 4);
  for (let i2 = 0; i2 < width * height; i2++) data.set(rgba, i2 * 4);
  return { width, height, channels: 4, data };
}

// packages/render/src/md5.ts
var S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
var K = Array.from(
  { length: 64 },
  (_, i2) => Math.floor(Math.abs(Math.sin(i2 + 1)) * 2 ** 32) >>> 0
);
function md5(data) {
  const padded = new Uint8Array(Math.ceil((data.length + 9) / 64) * 64);
  padded.set(data);
  padded[data.length] = 128;
  const view = new DataView(padded.buffer);
  const bits2 = data.length * 8;
  view.setUint32(padded.length - 8, bits2 >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bits2 / 2 ** 32), true);
  let [a0, b0, c0, d0] = [1732584193, 4023233417, 2562383102, 271733878];
  const m = new Uint32Array(16);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i2 = 0; i2 < 16; i2++) m[i2] = view.getUint32(off + i2 * 4, true);
    let [a, b, c, d] = [a0, b0, c0, d0];
    for (let i2 = 0; i2 < 64; i2++) {
      let f;
      let g;
      if (i2 < 16) {
        f = b & c | ~b & d;
        g = i2;
      } else if (i2 < 32) {
        f = d & b | ~d & c;
        g = (5 * i2 + 1) % 16;
      } else if (i2 < 48) {
        f = b ^ c ^ d;
        g = (3 * i2 + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = 7 * i2 % 16;
      }
      f = f + a + K[i2] + m[g] | 0;
      a = d;
      d = c;
      c = b;
      const s = S[(i2 >> 4) * 4 + i2 % 4];
      b = b + (f << s | f >>> 32 - s) | 0;
    }
    a0 = a0 + a | 0;
    b0 = b0 + b | 0;
    c0 = c0 + c | 0;
    d0 = d0 + d | 0;
  }
  const out = new Uint8Array(16);
  const ov = new DataView(out.buffer);
  for (const [i2, v] of [a0, b0, c0, d0].entries()) ov.setUint32(i2 * 4, v >>> 0, true);
  return out;
}

// packages/render/src/constants.ts
var DEFAULT_PROPS = {
  facing: "north",
  half: "bottom",
  shape: "straight",
  type: "bottom",
  // slabs
  axis: "y",
  hanging: "false",
  // lanterns
  waterlogged: "false",
  open: "false",
  // Sign templates key variants on rotation= / attached=.
  rotation: "0",
  attached: "false",
  // grass_block / mycelium / podzol are the only blockstates keyed on snowy=.
  snowy: "false"
};
var PLAINS_GRASS = [145, 189, 89];
var PLAINS_FOLIAGE = [119, 171, 47];
var PLAINS_DRY_FOLIAGE = [163, 117, 70];
var TINT_TABLE = {
  "minecraft:grass_block": PLAINS_GRASS,
  "minecraft:short_grass": PLAINS_GRASS,
  "minecraft:tall_grass": PLAINS_GRASS,
  "minecraft:fern": PLAINS_GRASS,
  "minecraft:large_fern": PLAINS_GRASS,
  "minecraft:potted_fern": PLAINS_GRASS,
  "minecraft:sugar_cane": PLAINS_GRASS,
  "minecraft:bush": PLAINS_GRASS,
  "minecraft:wildflowers": PLAINS_GRASS,
  "minecraft:pink_petals": PLAINS_GRASS,
  "minecraft:bamboo": PLAINS_GRASS,
  "minecraft:oak_leaves": PLAINS_FOLIAGE,
  "minecraft:jungle_leaves": PLAINS_FOLIAGE,
  "minecraft:acacia_leaves": PLAINS_FOLIAGE,
  "minecraft:dark_oak_leaves": PLAINS_FOLIAGE,
  "minecraft:mangrove_leaves": PLAINS_FOLIAGE,
  "minecraft:vine": PLAINS_FOLIAGE,
  "minecraft:leaf_litter": PLAINS_DRY_FOLIAGE,
  "minecraft:birch_leaves": [128, 167, 85],
  "minecraft:spruce_leaves": [97, 153, 97],
  "minecraft:lily_pad": [32, 128, 48]
};

// packages/render/src/pymath.ts
function pyRound(x2) {
  const r = Math.round(x2);
  return Math.abs(x2 % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}
var floorDivMod = (a, b, m) => (Math.floor(a / b) % m + m) % m;

// packages/render/src/models.ts
var SHADES = {
  "0,1,0": 1,
  "0,-1,0": 0.5,
  "0,0,-1": 0.8,
  "0,0,1": 0.8,
  "1,0,0": 0.6,
  "-1,0,0": 0.6
};
var FACE_NORMALS = {
  up: [0, 1, 0],
  down: [0, -1, 0],
  north: [0, 0, -1],
  south: [0, 0, 1],
  west: [-1, 0, 0],
  east: [1, 0, 0]
};
var UV_AXES = {
  north: [0, false, 1, false],
  south: [0, true, 1, false],
  west: [2, true, 1, false],
  east: [2, false, 1, false],
  up: [0, true, 2, true],
  down: [0, false, 2, true]
};
var FACE_NAMES = ["up", "down", "north", "south", "west", "east"];
var isFace = (n2) => Object.hasOwn(FACE_NORMALS, n2);
function rotY(p, degrees) {
  let [x2, y, z] = p;
  for (let i2 = 0; i2 < floorDivMod(degrees, 90, 4); i2++) [x2, y, z] = [1 - z, y, x2];
  return [x2, y, z];
}
function rotYDir(v, degrees) {
  let [x2, y, z] = v;
  for (let i2 = 0; i2 < floorDivMod(degrees, 90, 4); i2++) [x2, y, z] = [-z, y, x2];
  return [x2, y, z];
}
function rotX(p, degrees) {
  let [x2, y, z] = p;
  for (let i2 = 0; i2 < floorDivMod(degrees, 90, 4); i2++) {
    const ny = 1 - z;
    z = y;
    y = ny;
  }
  return [x2, y, z];
}
function rotXDir(v, degrees) {
  let [x2, y, z] = v;
  for (let i2 = 0; i2 < floorDivMod(degrees, 90, 4); i2++) {
    const ny = -z;
    z = y;
    y = ny;
  }
  return [x2, y, z];
}
var applyModelRotation = (p, xDeg, yDeg) => rotY(rotX(p, xDeg), yDeg);
var applyModelRotationDir = (v, xDeg, yDeg) => rotYDir(rotXDir(v, xDeg), yDeg);
function applyElementRotation(p, origin, axis, angleDeg) {
  const [ox, oy, oz] = origin.map((c2) => c2 / 16);
  const theta = angleDeg * Math.PI / 180;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const k = axis === "x" ? [1, 0, 0] : axis === "y" ? [0, 1, 0] : [0, 0, 1];
  const [vx, vy, vz] = [p[0] - ox, p[1] - oy, p[2] - oz];
  const cx = k[1] * vz - k[2] * vy;
  const cy = k[2] * vx - k[0] * vz;
  const cz = k[0] * vy - k[1] * vx;
  const dot2 = k[0] * vx + k[1] * vy + k[2] * vz;
  return [
    vx * c + cx * s + k[0] * dot2 * (1 - c) + ox,
    vy * c + cy * s + k[1] * dot2 * (1 - c) + oy,
    vz * c + cz * s + k[2] * dot2 * (1 - c) + oz
  ];
}
function applyRescale(p, origin, axis) {
  const s = Math.sqrt(2);
  const o = origin.map((c) => c / 16);
  const ax = axis === "x" ? 0 : axis === "y" ? 1 : 2;
  const q2 = [...p];
  for (let i2 = 0; i2 < 3; i2++)
    if (i2 !== ax) q2[i2] = o[i2] + (q2[i2] - o[i2]) * s;
  return q2;
}
var asObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v) ? v : null;
var lastAfterColon = (s) => s.slice(s.indexOf(":") + 1);
function modelElements(modelRef, assets) {
  return resolveModel(modelRef, assets);
}
function resolveModel(modelRef, assets) {
  const chain = [];
  const seen = /* @__PURE__ */ new Set();
  let ref = modelRef;
  for (let i2 = 0; i2 < 8; i2++) {
    const rel = lastAfterColon(ref);
    if (seen.has(rel)) break;
    seen.add(rel);
    const model = asObject(assets.readJson(`models/${rel}.json`));
    if (model === null) break;
    chain.push(model);
    const parent = model.parent;
    if (!parent || typeof parent !== "string") break;
    ref = parent;
  }
  if (chain.length === 0) return null;
  let elements = null;
  let ambientOcclusion = true;
  for (const model of chain) {
    if (Array.isArray(model.elements) && model.elements.length > 0) {
      elements = model.elements;
      ambientOcclusion = model.ambientocclusion === void 0 ? true : model.ambientocclusion;
      break;
    }
  }
  if (elements === null) return null;
  const textures = {};
  for (const model of [...chain].reverse()) Object.assign(textures, asObject(model.textures) ?? {});
  const sprite = (value) => {
    const o = asObject(value);
    return o !== null ? o.sprite ?? "" : value;
  };
  const resolve8 = (value, depth = 0) => {
    const v = sprite(value);
    if (typeof v !== "string" || !v.startsWith("#") || depth > 8) return v;
    return resolve8(textures[v.slice(1)] ?? "", depth + 1);
  };
  const images = /* @__PURE__ */ new Map();
  const ids = /* @__PURE__ */ new Map();
  for (const [name, value] of Object.entries(textures)) {
    const target = resolve8(value);
    const id = typeof target === "string" && target !== "" ? lastAfterColon(target) : null;
    const image = id === null ? null : assets.texture(id);
    images.set(name, image);
    ids.set(name, image === null ? null : id);
  }
  return { elements, images, ids, ambientOcclusion };
}
function whenMatches(when, props) {
  const w = asObject(when);
  if (w === null) return false;
  if ("OR" in w) return w.OR.some((c) => whenMatches(c, props));
  if ("AND" in w) return w.AND.every((c) => whenMatches(c, props));
  for (const [key2, value] of Object.entries(w)) {
    const propVal = props[key2];
    if (Array.isArray(value)) {
      if (propVal === void 0 || !value.includes(propVal)) return false;
    } else if (propVal !== value) return false;
  }
  return true;
}
function matchVariant(variants, explicit, defaults) {
  let best = null;
  let bestScore = null;
  for (const [key2, value] of Object.entries(variants)) {
    const pairs = key2 ? key2.split(",").filter((p) => p) : [];
    let nExp = 0;
    let nDef = 0;
    let ok = true;
    for (const p of pairs) {
      const eq = p.indexOf("=");
      const k = eq === -1 ? p : p.slice(0, eq);
      const v = eq === -1 ? "" : p.slice(eq + 1);
      if (Object.hasOwn(explicit, k)) {
        if (explicit[k] !== v) {
          ok = false;
          break;
        }
        nExp++;
      } else if (defaults[k] === v) nDef++;
    }
    if (!ok) continue;
    if (bestScore === null || nExp > bestScore[0] || nExp === bestScore[0] && nDef > bestScore[1]) {
      best = value;
      bestScore = [nExp, nDef];
    }
  }
  if (Array.isArray(best)) best = best.length > 0 ? best[0] : null;
  return asObject(best);
}
var applicationOf = (v) => ({
  model: v.model,
  x: Math.trunc(Number(v.x ?? 0)),
  y: Math.trunc(Number(v.y ?? 0)),
  uvlock: Boolean(v.uvlock ?? false)
});
function modelApplications(blockName, props, assets) {
  const short3 = lastAfterColon(blockName);
  const bs = asObject(assets.readJson(`blockstates/${short3}.json`));
  if (bs === null || Object.keys(bs).length === 0) return [];
  const full = { ...DEFAULT_PROPS, ...props };
  const apps = [];
  const variants = asObject(bs.variants);
  if (variants !== null && Object.keys(variants).length > 0) {
    const v = matchVariant(variants, props, DEFAULT_PROPS);
    if (v?.model) apps.push(applicationOf(v));
  } else if (Array.isArray(bs.multipart) && bs.multipart.length > 0) {
    for (const rawCase of bs.multipart) {
      const when = rawCase.when;
      if (when !== void 0 && when !== null && !whenMatches(when, full)) continue;
      let apply = rawCase.apply;
      if (Array.isArray(apply)) apply = apply.length > 0 ? apply[0] : null;
      const a = asObject(apply);
      if (a?.model) apps.push(applicationOf(a));
    }
  }
  return apps;
}
function snapNormal(v) {
  let ax = 0;
  for (let i2 = 1; i2 < 3; i2++) if (Math.abs(v[i2]) > Math.abs(v[ax])) ax = i2;
  const out = [0, 0, 0];
  out[ax] = v[ax] >= 0 ? 1 : -1;
  return out;
}
function faceBaseCorners(face, f, t) {
  const [x0, y0, z0] = f;
  const [x1, y1, z1] = t;
  switch (face) {
    case "up":
      return [
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x0, y1, z1]
      ];
    case "down":
      return [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1]
      ];
    case "north":
      return [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y1, z0],
        [x0, y1, z0]
      ];
    case "south":
      return [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1]
      ];
    case "west":
      return [
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, y1, z1],
        [x0, y1, z0]
      ];
    case "east":
      return [
        [x1, y0, z0],
        [x1, y0, z1],
        [x1, y1, z1],
        [x1, y1, z0]
      ];
  }
}
function orderCornersUv(corners2, face) {
  const [uAxis, uMinIsU0, vAxis, vMinIsV0] = UV_AXES[face];
  const key2 = (c) => {
    const u = c[uAxis];
    const v = c[vAxis];
    return [uMinIsU0 ? u : -u, vMinIsV0 ? v : -v];
  };
  const cmp = (a, b) => {
    const [ka, kb] = [key2(a), key2(b)];
    return ka[0] - kb[0] || ka[1] - kb[1];
  };
  const s = [...corners2].sort(cmp);
  const p00 = s[0];
  const p11 = s[3];
  const mids = [s[1], s[2]].sort(cmp);
  let p01 = mids[0];
  let p10 = mids[0];
  for (const c of mids) {
    if (key2(c)[1] > key2(p01)[1]) p01 = c;
    if (key2(c)[1] < key2(p10)[1]) p10 = c;
  }
  return [p00, p01, p11, p10];
}
function faceUvRotation(img, rotation) {
  const r = (rotation % 360 + 360) % 360;
  if (r === 90) return rotate90Cw(img);
  if (r === 180) return rotate180(img);
  if (r === 270) return rotate90Ccw(img);
  return img;
}
function resolveBlockQuads(blockName, props, assets, fallbackColor2, fallbackBlocks = /* @__PURE__ */ new Set()) {
  const apps = modelApplications(blockName, props, assets);
  if (apps.length === 0) return null;
  const quads = [];
  for (const { model, x: xDeg, y: yDeg, uvlock } of apps) {
    const resolved = resolveModel(model, assets);
    if (resolved === null) return null;
    const { elements, images, ids, ambientOcclusion } = resolved;
    for (const el of elements) {
      if (!Array.isArray(el.from) || !Array.isArray(el.to)) return null;
      const f = el.from.map((c) => c / 16);
      const t = el.to.map((c) => c / 16);
      const elRot = asObject(el.rotation);
      const hasRot = elRot !== null && Object.keys(elRot).length > 0;
      const origin = elRot?.origin ?? [8, 8, 8];
      const axis = elRot?.axis ?? "y";
      const angle = elRot?.angle ?? 0;
      const flat = el.shade === false || ambientOcclusion === false;
      const faces = asObject(el.faces) ?? {};
      for (const [faceName, rawFace] of Object.entries(faces)) {
        if (!isFace(faceName)) continue;
        const face = asObject(rawFace) ?? {};
        const corners2 = faceBaseCorners(faceName, f, t);
        const xform = (p) => {
          let q2 = p;
          if (hasRot) {
            if (elRot?.rescale) q2 = applyRescale(q2, origin, axis);
            q2 = applyElementRotation(q2, origin, axis, angle);
          }
          return applyModelRotation(q2, xDeg, yDeg);
        };
        const rotateDirThroughElement = (local) => {
          if (!hasRot) return local;
          const n2 = applyElementRotation(
            [0.5 + local[0], 0.5 + local[1], 0.5 + local[2]],
            origin,
            axis,
            angle
          );
          return [n2[0] - 0.5, n2[1] - 0.5, n2[2] - 0.5];
        };
        const worldFloat = applyModelRotationDir(
          rotateDirThroughElement(FACE_NORMALS[faceName]),
          xDeg,
          yDeg
        );
        const worldN = snapNormal(worldFloat);
        let cull = null;
        const cf = face.cullface;
        if (typeof cf === "string" && isFace(cf)) {
          cull = snapNormal(
            applyModelRotationDir(rotateDirThroughElement(FACE_NORMALS[cf]), xDeg, yDeg)
          );
        }
        const texVar = String(face.texture ?? "").replace(/^#+/, "");
        let img = images.get(texVar) ?? null;
        const uv = face.uv ?? [0, 0, 16, 16];
        let u0;
        let v0;
        let u1;
        let v1;
        let flipH = false;
        let flipV = false;
        let hasRealTexture = false;
        let rect = [0, 0, 0, 0];
        if (img === null) {
          fallbackBlocks.add(blockName);
          img = newImage(16, 16, fallbackColor2);
          [u0, v0, u1, v1] = [0, 0, 16, 16];
        } else {
          [u0, v0, u1, v1] = uv;
          flipH = u0 > u1;
          flipV = v0 > v1;
          if (flipH) [u0, u1] = [u1, u0];
          if (flipV) [v0, v1] = [v1, v0];
          hasRealTexture = true;
        }
        const [sx, sy] = [img.width / 16, img.height / 16];
        rect = [pyRound(u0 * sx), pyRound(v0 * sy), pyRound(u1 * sx), pyRound(v1 * sy)];
        let piece = crop(img, rect[0], rect[1], rect[2], rect[3]);
        if (piece.width < 1 || piece.height < 1) continue;
        if (flipH) piece = flipLeftRight(piece);
        if (flipV) piece = flipTopBottom(piece);
        const faceRotation = Math.trunc(Number(face.rotation ?? 0));
        piece = faceUvRotation(piece, faceRotation);
        const ti = face.tintindex;
        const tintRgb2 = Object.hasOwn(TINT_TABLE, blockName) ? TINT_TABLE[blockName] : void 0;
        let appliedTint = null;
        if (hasRealTexture && typeof ti === "number" && Number.isInteger(ti) && ti >= 0 && tintRgb2 !== void 0) {
          piece = tint(piece, tintRgb2);
          appliedTint = tintRgb2;
        }
        let ordered = orderCornersUv(corners2, faceName).map(xform);
        if (uvlock) {
          if (Math.abs(worldN[1]) < 0.5 && ordered[0][1] < ordered[1][1]) {
            ordered = [ordered[1], ordered[0], ordered[3], ordered[2]];
          }
        }
        const factor = flat ? 1 : SHADES[worldN.join(",")] ?? 0.75;
        const shaded = shade(piece, factor);
        const quad = { points: ordered, normal: worldFloat, image: shaded, cull, flat };
        const texId = hasRealTexture ? ids.get(texVar) ?? null : null;
        if (texId !== null) {
          const r = (faceRotation % 360 + 360) % 360;
          quad.tex = {
            id: texId,
            rect,
            flipH,
            flipV,
            rotation: r === 90 ? 90 : r === 180 ? 180 : r === 270 ? 270 : 0,
            tint: appliedTint,
            shade: factor
          };
        } else {
          quad.solid = [
            shaded.data[0],
            shaded.data[1],
            shaded.data[2],
            255
          ];
        }
        quads.push(quad);
      }
    }
  }
  return quads;
}
function splitBlockstate(canonical2) {
  const head = canonical2.split("{", 1)[0];
  const open = head.indexOf("[");
  if (open === -1) return [head, {}];
  const props = {};
  for (const p of head.slice(open + 1).replace(/\]+$/, "").split(",")) {
    const eq = p.indexOf("=");
    if (eq !== -1) props[p.slice(0, eq)] = p.slice(eq + 1);
  }
  return [head.slice(0, open), props];
}

// packages/render/src/blocks.ts
var FALLBACK_MAGENTA = [205, 70, 205];
var DYE_RGB = {
  white: [249, 255, 254],
  orange: [249, 128, 29],
  magenta: [199, 78, 189],
  light_blue: [58, 179, 218],
  yellow: [254, 216, 61],
  lime: [128, 199, 31],
  pink: [243, 139, 170],
  gray: [71, 79, 82],
  light_gray: [157, 157, 151],
  cyan: [22, 156, 156],
  purple: [137, 50, 184],
  blue: [60, 68, 170],
  brown: [131, 84, 50],
  green: [94, 124, 22],
  red: [176, 46, 38],
  black: [29, 29, 33]
};
var FLUID_RGBA = {
  "minecraft:water": [63, 118, 228, 150],
  "minecraft:lava": [255, 110, 20, 210],
  "minecraft:chest": [181, 140, 82, 255]
};
var FLUID_SURFACE_HEIGHT = 8 / 9;
var COPPER_CHEST = [200, 120, 70];
var FLAT_COLORS = {
  "minecraft:water": [63, 118, 228],
  "minecraft:lava": [255, 110, 20],
  "minecraft:chest": [181, 140, 82],
  "minecraft:trapped_chest": [170, 110, 75],
  "minecraft:ender_chest": [60, 55, 70]
};
for (const stage of ["", "exposed_", "weathered_", "oxidized_"]) {
  FLAT_COLORS[`minecraft:${stage}copper_chest`] = COPPER_CHEST;
  FLAT_COLORS[`minecraft:waxed_${stage}copper_chest`] = COPPER_CHEST;
}
for (const [dye, rgb] of Object.entries(DYE_RGB)) {
  FLAT_COLORS[`minecraft:${dye}_banner`] = rgb;
  FLAT_COLORS[`minecraft:${dye}_wall_banner`] = rgb;
}
var hasFlatColor = (name) => Object.hasOwn(FLAT_COLORS, name);
function fallbackColor(blockName) {
  const flat = Object.hasOwn(FLAT_COLORS, blockName) ? FLAT_COLORS[blockName] : void 0;
  if (flat !== void 0) return flat;
  const d = md5(new TextEncoder().encode(blockName));
  return [d[0], d[1], d[2]];
}
function fallbackCubeQuads(color) {
  const img = newImage(16, 16, color);
  return FACE_NAMES.map((face) => {
    const ordered = orderCornersUv(faceBaseCorners(face, [0, 0, 0], [1, 1, 1]), face);
    const n2 = FACE_NORMALS[face];
    const shaded = shade(img, SHADES[n2.join(",")]);
    return {
      points: ordered,
      normal: n2,
      image: shaded,
      cull: n2,
      flat: false,
      solid: [shaded.data[0], shaded.data[1], shaded.data[2], 255]
    };
  });
}
function fluidCubeQuads(rgba, topHeight = 1) {
  const [r, g, b, a] = rgba;
  return FACE_NAMES.map((face) => {
    const t = [1, face === "up" ? topHeight : 1, 1];
    const ordered = orderCornersUv(faceBaseCorners(face, [0, 0, 0], t), face);
    const n2 = FACE_NORMALS[face];
    const factor = SHADES[n2.join(",")];
    const solid = [
      Math.min(255, Math.trunc(r * factor)),
      Math.min(255, Math.trunc(g * factor)),
      Math.min(255, Math.trunc(b * factor)),
      a
    ];
    const img = solidRgba(16, 16, solid);
    return { points: ordered, normal: n2, image: img, cull: n2, flat: false, solid };
  });
}
var ENTITY_TEXTURES = {
  "minecraft:chest": "entity/chest/normal",
  "minecraft:trapped_chest": "entity/chest/trapped",
  "minecraft:ender_chest": "entity/chest/ender",
  "minecraft:copper_chest": "entity/chest/copper",
  "minecraft:exposed_copper_chest": "entity/chest/copper_exposed",
  "minecraft:weathered_copper_chest": "entity/chest/copper_weathered",
  "minecraft:oxidized_copper_chest": "entity/chest/copper_oxidized",
  "minecraft:waxed_copper_chest": "entity/chest/copper",
  "minecraft:waxed_exposed_copper_chest": "entity/chest/copper_exposed",
  "minecraft:waxed_weathered_copper_chest": "entity/chest/copper_weathered",
  "minecraft:waxed_oxidized_copper_chest": "entity/chest/copper_oxidized"
};
var CHEST_BODY_UVS = {
  north: [14, 33, 28, 43],
  south: [42, 33, 56, 43],
  east: [28, 33, 42, 43],
  west: [0, 33, 14, 43],
  up: [14, 19, 28, 33],
  down: [28, 19, 42, 33]
};
var CHEST_LID_UVS = {
  north: [14, 14, 28, 19],
  south: [42, 14, 56, 19],
  east: [28, 14, 42, 19],
  west: [0, 14, 14, 19],
  up: [14, 0, 28, 14],
  down: [28, 0, 42, 14]
};
var CHEST_LATCH_UVS = {
  north: [1, 1, 3, 5],
  south: [4, 1, 6, 5],
  east: [3, 1, 4, 5],
  west: [0, 1, 1, 5],
  up: [1, 0, 3, 1],
  down: [3, 0, 5, 1]
};
var BANNER_TEXTURE = "entity/banner/banner_base";
var FACING_Y_ROT = { north: 0, east: 90, south: 180, west: 270 };
var WALL_BANNER_Y_ROT = { south: 0, west: 90, north: 180, east: 270 };
function rotYDeg(p, degrees) {
  let [x2, y, z] = p;
  for (let i2 = 0; i2 < floorDivMod(degrees, 90, 4); i2++) [x2, y, z] = [1 - z, y, x2];
  return [x2, y, z];
}
function rotYDirDeg(v, degrees) {
  let [x2, y, z] = v;
  for (let i2 = 0; i2 < floorDivMod(degrees, 90, 4); i2++) [x2, y, z] = [-z, y, x2];
  return [x2, y, z];
}
function rotYContinuous(p, degrees) {
  const theta = degrees * Math.PI / 180;
  const [c, s] = [Math.cos(theta), Math.sin(theta)];
  const [vx, vz] = [p[0] - 0.5, p[2] - 0.5];
  return [0.5 + c * vx - s * vz, p[1], 0.5 + s * vx + c * vz];
}
function rotYContinuousDir(v, degrees) {
  const theta = degrees * Math.PI / 180;
  const [c, s] = [Math.cos(theta), Math.sin(theta)];
  return [c * v[0] - s * v[2], v[1], s * v[0] + c * v[2]];
}
function entityBoxQuads(f, t, faceUvs, img, texId, tint2 = null) {
  const out = [];
  for (const [face, rect] of Object.entries(faceUvs)) {
    const piece = crop(img, rect[0], rect[1], rect[2], rect[3]);
    if (piece.width < 1 || piece.height < 1) continue;
    out.push({
      points: orderCornersUv(faceBaseCorners(face, f, t), face),
      normal: FACE_NORMALS[face],
      crop: piece,
      texId,
      rect,
      tint: tint2
    });
  }
  return out;
}
function finalizeEntityQuads(quads, degrees, continuous = false) {
  return quads.map(({ points, normal, crop: piece, texId, rect, tint: tint2 }) => {
    const pts = points.map((p) => continuous ? rotYContinuous(p, degrees) : rotYDeg(p, degrees));
    const n2 = snapNormal(
      continuous ? rotYContinuousDir(normal, degrees) : rotYDirDeg(normal, degrees)
    );
    const factor = SHADES[n2.join(",")] ?? 0.75;
    return {
      points: pts,
      normal: n2,
      image: shade(piece, factor),
      cull: null,
      flat: false,
      tex: { id: texId, rect, flipH: false, flipV: false, rotation: 0, tint: tint2, shade: factor }
    };
  });
}
function fillTransparentCorners(img, corners2) {
  if (img.channels !== 4) return;
  for (const [x2, y] of corners2) {
    for (const [nx, ny] of [
      [x2 + 1, y],
      [x2 - 1, y],
      [x2, y + 1],
      [x2, y - 1]
    ]) {
      if (nx >= 0 && nx < img.width && ny >= 0 && ny < img.height) {
        const [r, g, b, a] = getPixel(img, nx, ny);
        if (a === 255) {
          setPixel(img, x2, y, [r, g, b, 255]);
          break;
        }
      }
    }
  }
}
function chestQuads(props, source, texId) {
  if (source.width !== 64 || source.height !== 64) return null;
  const img = copyImage(source);
  fillTransparentCorners(img, [
    [0, 0],
    [5, 0]
  ]);
  const parts = [
    ...entityBoxQuads(
      [1 / 16, 0, 1 / 16],
      [15 / 16, 10 / 16, 15 / 16],
      CHEST_BODY_UVS,
      img,
      texId
    ),
    ...entityBoxQuads(
      [1 / 16, 10 / 16, 1 / 16],
      [15 / 16, 15 / 16, 15 / 16],
      CHEST_LID_UVS,
      img,
      texId
    ),
    ...entityBoxQuads(
      [7 / 16, 9 / 16, 0],
      [9 / 16, 13 / 16, 1 / 16],
      CHEST_LATCH_UVS,
      img,
      texId
    )
  ];
  return finalizeEntityQuads(parts, FACING_Y_ROT[props.facing ?? "north"] ?? 0);
}
function bannerQuads(props, img, dye, wall) {
  const texId = BANNER_TEXTURE;
  if (img.width !== 64 || img.height !== 64) return null;
  const panel = copyImage(img);
  paste(panel, tintRgb(crop(img, 0, 0, 22, 41), dye), 0, 0);
  paste(panel, tintRgb(crop(img, 22, 0, 42, 41), dye), 22, 0);
  fillTransparentCorners(panel, [
    [0, 0],
    [41, 0]
  ]);
  const quads = [];
  if (!wall) {
    const poleUvs = {
      north: [44, 2, 46, 42],
      south: [46, 2, 48, 42],
      east: [48, 2, 50, 42],
      west: [50, 2, 52, 42],
      up: [46, 0, 48, 2]
    };
    quads.push(
      ...entityBoxQuads([7 / 16, 0, 7 / 16], [9 / 16, 14 / 16, 9 / 16], poleUvs, img, texId)
    );
  }
  const barUvs = {
    north: [12, 42, 32, 44],
    south: [12, 42, 32, 44],
    east: [2, 42, 4, 44],
    west: [40, 42, 42, 44],
    up: [12, 42, 32, 44],
    down: [12, 42, 32, 44]
  };
  let clothF;
  let clothT;
  if (wall) {
    quads.push(
      ...entityBoxQuads([-2 / 16, 12 / 16, 0], [18 / 16, 14 / 16, 2 / 16], barUvs, img, texId)
    );
    clothF = [-2 / 16, 2 / 16, 0.5 / 16];
    clothT = [18 / 16, 12 / 16, 1.5 / 16];
  } else {
    quads.push(
      ...entityBoxQuads([-2 / 16, 12 / 16, 7 / 16], [18 / 16, 14 / 16, 9 / 16], barUvs, img, texId)
    );
    clothF = [-2 / 16, 2 / 16, 7.5 / 16];
    clothT = [18 / 16, 12 / 16, 8.5 / 16];
  }
  const clothUvs = {
    south: [0, 0, 22, 41],
    north: [22, 0, 42, 41],
    east: [20, 0, 22, 41],
    west: [0, 0, 2, 41],
    up: [0, 0, 22, 2],
    down: [0, 39, 22, 41]
  };
  quads.push(...entityBoxQuads(clothF, clothT, clothUvs, panel, texId, dye));
  if (wall) return finalizeEntityQuads(quads, WALL_BANNER_Y_ROT[props.facing ?? "north"] ?? 0);
  const rotation = Number.parseInt(props.rotation ?? "0", 10);
  return finalizeEntityQuads(
    quads,
    ((Number.isNaN(rotation) ? 0 : rotation) % 16 + 16) % 16 * 22.5,
    true
  );
}
function tryEntityQuads(name, props, assets) {
  if (Object.hasOwn(ENTITY_TEXTURES, name)) {
    const img2 = assets.texture(ENTITY_TEXTURES[name]);
    return img2 === null ? null : chestQuads(props, img2, ENTITY_TEXTURES[name]);
  }
  const short3 = name.slice(name.indexOf(":") + 1);
  let color;
  let wall;
  if (short3.endsWith("_wall_banner")) {
    color = short3.slice(0, -"_wall_banner".length);
    wall = true;
  } else if (short3.endsWith("_banner")) {
    color = short3.slice(0, -"_banner".length);
    wall = false;
  } else return null;
  const dye = Object.hasOwn(DYE_RGB, color) ? DYE_RGB[color] : void 0;
  if (dye === void 0) return null;
  const img = assets.texture(BANNER_TEXTURE);
  return img === null ? null : bannerQuads(props, img, dye, wall);
}
function blockQuads(canonical2, assets, fallbackBlocks = /* @__PURE__ */ new Set()) {
  const [name, props] = splitBlockstate(canonical2);
  if (assets !== null) {
    const entity = tryEntityQuads(name, props, assets);
    if (entity !== null) return { quads: entity, isFallback: false };
  }
  const fluid = Object.hasOwn(FLUID_RGBA, name) ? FLUID_RGBA[name] : void 0;
  if (fluid !== void 0) {
    const top = name === "minecraft:water" || name === "minecraft:lava" ? FLUID_SURFACE_HEIGHT : 1;
    return { quads: fluidCubeQuads(fluid, top), isFallback: false };
  }
  if (assets === null) return { quads: fallbackCubeQuads(FALLBACK_MAGENTA), isFallback: true };
  const quads = resolveBlockQuads(name, props, assets, fallbackColor(name), fallbackBlocks);
  if (quads === null || quads.length === 0)
    return { quads: fallbackCubeQuads(FALLBACK_MAGENTA), isFallback: true };
  return { quads, isFallback: false };
}

// packages/render/src/draw.ts
function createCanvas(width, height, rgb) {
  const data = new Uint8Array(width * height * 3);
  for (let i2 = 0; i2 < width * height; i2++) data.set(rgb, i2 * 3);
  return { width, height, data };
}
function set(c, x2, y, rgb) {
  if (x2 < 0 || y < 0 || x2 >= c.width || y >= c.height) return;
  c.data.set(rgb, (y * c.width + x2) * 3);
}
function drawLine2(c, x0, y0, x1, y1, rgb) {
  let [x2, y] = [Math.round(x0), Math.round(y0)];
  const [ex, ey] = [Math.round(x1), Math.round(y1)];
  const dx = Math.abs(ex - x2);
  const dy = -Math.abs(ey - y);
  const sx = x2 < ex ? 1 : -1;
  const sy = y < ey ? 1 : -1;
  let err2 = dx + dy;
  for (; ; ) {
    set(c, x2, y, rgb);
    if (x2 === ex && y === ey) break;
    const e2 = 2 * err2;
    if (e2 >= dy) {
      err2 += dy;
      x2 += sx;
    }
    if (e2 <= dx) {
      err2 += dx;
      y += sy;
    }
  }
}
function drawRect(c, x0, y0, x1, y1, fill, outline) {
  const [lx, hx] = [Math.round(Math.min(x0, x1)), Math.round(Math.max(x0, x1))];
  const [ly, hy] = [Math.round(Math.min(y0, y1)), Math.round(Math.max(y0, y1))];
  for (let y = ly; y <= hy; y++) for (let x2 = lx; x2 <= hx; x2++) set(c, x2, y, fill);
  if (outline) {
    for (let x2 = lx; x2 <= hx; x2++) {
      set(c, x2, ly, outline);
      set(c, x2, hy, outline);
    }
    for (let y = ly; y <= hy; y++) {
      set(c, lx, y, outline);
      set(c, hx, y, outline);
    }
  }
}
function drawPolygon(c, pts, fill, outline) {
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    const yc = y + 0.5;
    const xs = [];
    for (let i2 = 0; i2 < pts.length; i2++) {
      const [x1, y1] = pts[i2];
      const [x2, y2] = pts[(i2 + 1) % pts.length];
      if (y1 <= yc && y2 > yc || y2 <= yc && y1 > yc)
        xs.push(x1 + (yc - y1) / (y2 - y1) * (x2 - x1));
    }
    if (xs.length < 2) continue;
    const [a, b] = [Math.min(...xs), Math.max(...xs)];
    for (let x2 = Math.round(a); x2 <= Math.round(b); x2++) set(c, x2, y, fill);
  }
  if (outline)
    for (let i2 = 0; i2 < pts.length; i2++) {
      const [x1, y1] = pts[i2];
      const [x2, y2] = pts[(i2 + 1) % pts.length];
      drawLine2(c, x1, y1, x2, y2, outline);
    }
}
function drawEllipse(c, x0, y0, x1, y1, fill, outline) {
  const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
  const [rx, ry] = [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2];
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x2 = Math.floor(cx - rx); x2 <= Math.ceil(cx + rx); x2++) {
      const [nx, ny] = [(x2 + 0.5 - cx) / rx, (y + 0.5 - cy) / ry];
      const d = nx * nx + ny * ny;
      if (d <= 1) set(c, x2, y, outline && d > 0.6 ? outline : fill);
    }
  }
}
function resizeNearest(img, w, h) {
  const data = new Uint8Array(w * h * img.channels);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(img.height - 1, Math.floor((y + 0.5) * img.height / h));
    for (let x2 = 0; x2 < w; x2++) {
      const sx = Math.min(img.width - 1, Math.floor((x2 + 0.5) * img.width / w));
      for (let k = 0; k < img.channels; k++)
        data[(y * w + x2) * img.channels + k] = img.data[(sy * img.width + sx) * img.channels + k];
    }
  }
  return { width: w, height: h, channels: img.channels, data };
}
function pasteRgb(c, img, left, top) {
  for (let y = 0; y < img.height; y++) {
    for (let x2 = 0; x2 < img.width; x2++) {
      const i2 = (y * img.width + x2) * img.channels;
      set(c, left + x2, top + y, [
        img.data[i2],
        img.data[i2 + 1],
        img.data[i2 + 2]
      ]);
    }
  }
}
function blendToward(img, bg, alpha) {
  const data = new Uint8Array(img.data);
  for (let i2 = 0; i2 < img.width * img.height; i2++) {
    for (let k = 0; k < 3; k++) {
      const a = data[i2 * img.channels + k];
      data[i2 * img.channels + k] = Math.trunc(a + alpha * (bg[k] - a));
    }
  }
  return { ...img, data };
}
function blendPixel(c, x2, y, rgb, alpha) {
  if (x2 < 0 || y < 0 || x2 >= c.width || y >= c.height || alpha <= 0) return;
  const i2 = (y * c.width + x2) * 3;
  for (let k = 0; k < 3; k++)
    c.data[i2 + k] = Math.floor(
      (rgb[k] * alpha + c.data[i2 + k] * (255 - alpha) + 127) / 255
    );
}
function fillRectAlpha(c, x0, y0, x1, y1, rgb, alpha) {
  const [lx, hx] = [Math.round(Math.min(x0, x1)), Math.round(Math.max(x0, x1))];
  const [ly, hy] = [Math.round(Math.min(y0, y1)), Math.round(Math.max(y0, y1))];
  for (let y = ly; y <= hy; y++) for (let x2 = lx; x2 <= hx; x2++) blendPixel(c, x2, y, rgb, alpha);
}
function drawLineAlpha(c, x0, y0, x1, y1, rgb, alpha, width = 1) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
  const half = (width - 1) / 2;
  const seen = /* @__PURE__ */ new Set();
  for (let i2 = 0; i2 <= steps; i2++) {
    const x2 = x0 + (x1 - x0) * i2 / steps;
    const y = y0 + (y1 - y0) * i2 / steps;
    for (let dy = -Math.ceil(half); dy <= Math.ceil(half); dy++) {
      for (let dx = -Math.ceil(half); dx <= Math.ceil(half); dx++) {
        const [px, py] = [Math.round(x2) + dx, Math.round(y) + dy];
        const key2 = py * 1e5 + px;
        if (seen.has(key2)) continue;
        seen.add(key2);
        blendPixel(c, px, py, rgb, alpha);
      }
    }
  }
}
function drawRingAlpha(c, cx, cy, radius, rgb, alpha, width = 2) {
  const [inner, outer] = [radius - width, radius];
  for (let y = Math.floor(cy - outer); y <= Math.ceil(cy + outer); y++) {
    for (let x2 = Math.floor(cx - outer); x2 <= Math.ceil(cx + outer); x2++) {
      const d = Math.hypot(x2 + 0.5 - cx, y + 0.5 - cy);
      if (d <= outer && d > inner) blendPixel(c, x2, y, rgb, alpha);
    }
  }
}

// packages/render/src/fast.ts
var TEMPLATE_PARENTS = /* @__PURE__ */ new Set(["cube_all", "cube_column", "cube", "cube_mirrored"]);
var FACES = ["up", "down", "north", "south", "east", "west"];
var asObject2 = (v) => typeof v === "object" && v !== null && !Array.isArray(v) ? v : null;
var afterColon = (s) => s.slice(s.indexOf(":") + 1);
function matchVariant2(variants, explicit) {
  let best = null;
  let bestScore = null;
  for (const [key2, value] of Object.entries(variants)) {
    const pairs = key2 ? key2.split(",").filter((p) => p) : [];
    let nExp = 0;
    let nDef = 0;
    let ok = true;
    for (const p of pairs) {
      const eq = p.indexOf("=");
      const k = eq === -1 ? p : p.slice(0, eq);
      const v = eq === -1 ? "" : p.slice(eq + 1);
      if (Object.hasOwn(explicit, k)) {
        if (explicit[k] !== v) {
          ok = false;
          break;
        }
        nExp++;
      } else if (DEFAULT_PROPS[k] === v) nDef++;
    }
    if (!ok) continue;
    if (bestScore === null || nExp > bestScore[0] || nExp === bestScore[0] && nDef > bestScore[1]) {
      best = value;
      bestScore = [nExp, nDef];
    }
  }
  if (Array.isArray(best)) best = best.length > 0 ? best[0] : null;
  return asObject2(best);
}
function resolveModelTextures(blockName, props, assets) {
  const empty = { images: /* @__PURE__ */ new Map(), parentLeaf: null, tintedVars: /* @__PURE__ */ new Set() };
  try {
    const bs = asObject2(assets.readJson(`blockstates/${afterColon(blockName)}.json`));
    if (bs === null) return empty;
    let modelRef = null;
    const variants = asObject2(bs.variants);
    if (variants !== null && Object.keys(variants).length > 0) {
      const v = matchVariant2(variants, props);
      if (v?.model) modelRef = v.model;
    } else if (Array.isArray(bs.multipart) && bs.multipart.length > 0) {
      for (const c of bs.multipart) {
        let apply = c.apply;
        if (Array.isArray(apply)) apply = apply.length > 0 ? apply[0] : null;
        const a = asObject2(apply);
        if (a?.model) {
          modelRef = a.model;
          break;
        }
      }
    }
    if (!modelRef) return empty;
    const chain = [];
    const seen = /* @__PURE__ */ new Set();
    let ref = modelRef;
    for (let i2 = 0; i2 < 8; i2++) {
      const rel = afterColon(ref);
      if (seen.has(rel)) break;
      seen.add(rel);
      const model = asObject2(assets.readJson(`models/${rel}.json`));
      if (model === null) break;
      chain.push(model);
      if (!model.parent || typeof model.parent !== "string") break;
      ref = model.parent;
    }
    if (chain.length === 0) return empty;
    const textures = {};
    for (const model of [...chain].reverse())
      Object.assign(textures, asObject2(model.textures) ?? {});
    const sprite = (value) => {
      const o = asObject2(value);
      return o !== null ? o.sprite ?? "" : value;
    };
    const resolve8 = (value, depth = 0) => {
      const v = sprite(value);
      if (typeof v !== "string" || !v.startsWith("#") || depth > 8) return v;
      return resolve8(textures[v.slice(1)] ?? "", depth + 1);
    };
    const leaves = [];
    ref = modelRef;
    for (const model of chain) {
      leaves.push(afterColon(ref).split("/").pop() ?? "");
      ref = typeof model.parent === "string" ? model.parent : "";
    }
    const parentLeaf = leaves.find((l) => TEMPLATE_PARENTS.has(l)) ?? null;
    const images = /* @__PURE__ */ new Map();
    for (const [name, value] of Object.entries(textures)) {
      const target = resolve8(value);
      images.set(
        name,
        typeof target === "string" && target !== "" ? assets.texture(afterColon(target), { firstFrameOnly: false }) : null
      );
    }
    const tintedVars = /* @__PURE__ */ new Set();
    for (const model of chain) {
      if (Array.isArray(model.elements) && model.elements.length > 0) {
        for (const el of model.elements) {
          const faces = asObject2(asObject2(el)?.faces) ?? {};
          for (const face of Object.values(faces)) {
            const f = asObject2(face);
            if (f === null) continue;
            const ti = f.tintindex ?? -1;
            if (typeof ti === "number" && Number.isInteger(ti) && ti >= 0) {
              const v = String(f.texture ?? "").replace(/^#+/, "");
              if (images.has(v)) tintedVars.add(v);
            }
          }
        }
        break;
      }
    }
    return { images, parentLeaf, tintedVars };
  } catch {
    return empty;
  }
}
function faceTexVars(images, parentLeaf) {
  const keys = new Set([...images].filter(([, v]) => v !== null).map(([k]) => k));
  const all = (v) => ({
    up: v,
    down: v,
    north: v,
    south: v,
    east: v,
    west: v
  });
  if (parentLeaf === "cube_all") return all(keys.has("all") ? "all" : null);
  if (parentLeaf === "cube_column") {
    const end = keys.has("end") ? "end" : null;
    const side2 = keys.has("side") ? "side" : null;
    return { up: end, down: end, north: side2, south: side2, east: side2, west: side2 };
  }
  const pick2 = (...cands) => cands.find((c) => keys.has(c)) ?? null;
  const anyTex = [...keys].find((k) => k !== "particle") ?? null;
  const side = pick2("side", "front", "all", "texture") ?? anyTex;
  return {
    up: pick2("top", "up", "end", "all", "texture") ?? side,
    down: pick2("bottom", "down", "end", "all", "texture") ?? side,
    north: side,
    south: side,
    east: side,
    west: side
  };
}
function buildFaceTextures(block, assets, fallbackBlocks = /* @__PURE__ */ new Set()) {
  const [name, props] = splitBlockstate(block);
  const resolved = assets === null ? { images: /* @__PURE__ */ new Map(), parentLeaf: null, tintedVars: /* @__PURE__ */ new Set() } : resolveModelTextures(name, props, assets);
  const vars = faceTexVars(resolved.images, resolved.parentLeaf);
  const tintRgb2 = Object.hasOwn(TINT_TABLE, name) ? TINT_TABLE[name] : void 0;
  const out = {};
  for (const face of FACES) {
    const v = vars[face];
    let img = v ? resolved.images.get(v) ?? null : null;
    if (img === null) {
      if (!hasFlatColor(name)) fallbackBlocks.add(name);
      img = newImage(16, 16, fallbackColor(name));
    } else if (v && resolved.tintedVars.has(v) && tintRgb2 !== void 0) {
      img = tint(img, tintRgb2);
    }
    out[face] = img;
  }
  return out;
}

// packages/render/src/font.ts
var G = {
  " ": ".....|.....|.....|.....|.....|.....|.....",
  "!": "..#..|..#..|..#..|..#..|..#..|.....|..#..",
  '"': ".#.#.|.#.#.|.....|.....|.....|.....|.....",
  "#": ".#.#.|#####|.#.#.|.#.#.|#####|.#.#.|.#.#.",
  $: "..#..|.####|#.#..|.###.|..#.#|####.|..#..",
  "%": "##..#|##..#|...#.|..#..|.#...|#..##|#..##",
  "&": ".##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#",
  "'": "..#..|..#..|.#...|.....|.....|.....|.....",
  "(": "...#.|..#..|.#...|.#...|.#...|..#..|...#.",
  ")": ".#...|..#..|...#.|...#.|...#.|..#..|.#...",
  "*": ".....|#.#.#|.###.|#####|.###.|#.#.#|.....",
  "+": ".....|..#..|..#..|#####|..#..|..#..|.....",
  ",": ".....|.....|.....|.....|..#..|..#..|.#...",
  "-": ".....|.....|.....|#####|.....|.....|.....",
  ".": ".....|.....|.....|.....|.....|.##..|.##..",
  "/": "....#|....#|...#.|..#..|.#...|#....|#....",
  "0": ".###.|#...#|#..##|#.#.#|##..#|#...#|.###.",
  "1": "..#..|.##..|..#..|..#..|..#..|..#..|.###.",
  "2": ".###.|#...#|....#|...#.|..#..|.#...|#####",
  "3": ".###.|#...#|....#|..##.|....#|#...#|.###.",
  "4": "...#.|..##.|.#.#.|#..#.|#####|...#.|...#.",
  "5": "#####|#....|####.|....#|....#|#...#|.###.",
  "6": "..##.|.#...|#....|####.|#...#|#...#|.###.",
  "7": "#####|....#|...#.|..#..|.#...|.#...|.#...",
  "8": ".###.|#...#|#...#|.###.|#...#|#...#|.###.",
  "9": ".###.|#...#|#...#|.####|....#|...#.|.##..",
  ":": ".....|.##..|.##..|.....|.##..|.##..|.....",
  ";": ".....|.##..|.##..|.....|.##..|..#..|.#...",
  "<": "...#.|..#..|.#...|#....|.#...|..#..|...#.",
  "=": ".....|.....|#####|.....|#####|.....|.....",
  ">": ".#...|..#..|...#.|....#|...#.|..#..|.#...",
  "?": ".###.|#...#|....#|...#.|..#..|.....|..#..",
  "@": ".###.|#...#|#.###|#.#.#|#.###|#....|.###.",
  A: ".###.|#...#|#...#|#####|#...#|#...#|#...#",
  B: "####.|#...#|#...#|####.|#...#|#...#|####.",
  C: ".###.|#...#|#....|#....|#....|#...#|.###.",
  D: "####.|#...#|#...#|#...#|#...#|#...#|####.",
  E: "#####|#....|#....|####.|#....|#....|#####",
  F: "#####|#....|#....|####.|#....|#....|#....",
  G: ".###.|#...#|#....|#.###|#...#|#...#|.###.",
  H: "#...#|#...#|#...#|#####|#...#|#...#|#...#",
  I: ".###.|..#..|..#..|..#..|..#..|..#..|.###.",
  J: "..###|...#.|...#.|...#.|...#.|#..#.|.##..",
  K: "#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#",
  L: "#....|#....|#....|#....|#....|#....|#####",
  M: "#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#",
  N: "#...#|##..#|#.#.#|#..##|#...#|#...#|#...#",
  O: ".###.|#...#|#...#|#...#|#...#|#...#|.###.",
  P: "####.|#...#|#...#|####.|#....|#....|#....",
  Q: ".###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#",
  R: "####.|#...#|#...#|####.|#.#..|#..#.|#...#",
  S: ".####|#....|#....|.###.|....#|....#|####.",
  T: "#####|..#..|..#..|..#..|..#..|..#..|..#..",
  U: "#...#|#...#|#...#|#...#|#...#|#...#|.###.",
  V: "#...#|#...#|#...#|#...#|#...#|.#.#.|..#..",
  W: "#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#",
  X: "#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#",
  Y: "#...#|#...#|.#.#.|..#..|..#..|..#..|..#..",
  Z: "#####|....#|...#.|..#..|.#...|#....|#####",
  "[": ".###.|.#...|.#...|.#...|.#...|.#...|.###.",
  "\\": "#....|#....|.#...|..#..|...#.|....#|....#",
  "]": ".###.|...#.|...#.|...#.|...#.|...#.|.###.",
  "^": "..#..|.#.#.|#...#|.....|.....|.....|.....",
  _: ".....|.....|.....|.....|.....|.....|#####",
  "`": ".#...|..#..|...#.|.....|.....|.....|.....",
  a: ".....|.....|.###.|....#|.####|#...#|.####",
  b: "#....|#....|####.|#...#|#...#|#...#|####.",
  c: ".....|.....|.###.|#....|#....|#...#|.###.",
  d: "....#|....#|.####|#...#|#...#|#...#|.####",
  e: ".....|.....|.###.|#...#|#####|#....|.###.",
  f: "..##.|.#..#|.#...|####.|.#...|.#...|.#...",
  g: ".....|.....|.####|#...#|#...#|.####|....#|#...#|.###.",
  h: "#....|#....|#.##.|##..#|#...#|#...#|#...#",
  i: "..#..|.....|.##..|..#..|..#..|..#..|.###.",
  j: "...#.|.....|..##.|...#.|...#.|...#.|...#.|#..#.|.##..",
  k: "#....|#....|#..#.|#.#..|##...|#.#..|#..#.",
  l: ".##..|..#..|..#..|..#..|..#..|..#..|.###.",
  m: ".....|.....|##.#.|#.#.#|#.#.#|#.#.#|#...#",
  n: ".....|.....|#.##.|##..#|#...#|#...#|#...#",
  o: ".....|.....|.###.|#...#|#...#|#...#|.###.",
  p: ".....|.....|####.|#...#|#...#|####.|#....|#....|#....",
  q: ".....|.....|.####|#...#|#...#|.####|....#|....#|....#",
  r: ".....|.....|#.##.|##..#|#....|#....|#....",
  s: ".....|.....|.####|#....|.###.|....#|####.",
  t: ".#...|.#...|####.|.#...|.#...|.#..#|..##.",
  u: ".....|.....|#...#|#...#|#...#|#..##|.##.#",
  v: ".....|.....|#...#|#...#|#...#|.#.#.|..#..",
  w: ".....|.....|#...#|#...#|#.#.#|#.#.#|.#.#.",
  x: ".....|.....|#...#|.#.#.|..#..|.#.#.|#...#",
  y: ".....|.....|#...#|#...#|#...#|.####|....#|#...#|.###.",
  z: ".....|.....|#####|...#.|..#..|.#...|#####",
  "{": "..##.|.#...|.#...|#....|.#...|.#...|..##.",
  "|": "..#..|..#..|..#..|..#..|..#..|..#..|..#..",
  "}": ".##..|...#.|...#.|....#|...#.|...#.|.##..",
  "~": ".....|.....|.#..#|#.##.|.....|.....|....."
};
var GLYPHS = new Map(
  Object.entries(G).map(([ch, rows]) => [ch, rows.split("|")])
);
var textScale = (size) => Math.max(1, Math.round(size / 9));
var textWidth = (text2, size) => text2.length * 6 * textScale(size);
function plot(canvas, x2, y, rgb) {
  if (x2 < 0 || y < 0 || x2 >= canvas.width || y >= canvas.height) return;
  const i2 = (y * canvas.width + x2) * 3;
  canvas.data[i2] = rgb[0];
  canvas.data[i2 + 1] = rgb[1];
  canvas.data[i2 + 2] = rgb[2];
}
function glyphPass(canvas, x2, y, text2, scale, rgb, grow) {
  let cx = x2;
  for (const ch of text2) {
    const rows = GLYPHS.get(ch) ?? GLYPHS.get("?");
    if (rows) {
      rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          if (row[rx] !== "#") continue;
          for (let dy = -grow; dy < scale + grow; dy++) {
            for (let dx = -grow; dx < scale + grow; dx++)
              plot(canvas, cx + rx * scale + dx, y + ry * scale + dy, rgb);
          }
        }
      });
    }
    cx += 6 * scale;
  }
}
function drawText(canvas, x2, y, text2, options) {
  const scale = textScale(options.size);
  if (options.stroke)
    glyphPass(canvas, x2, y, text2, scale, options.strokeColor ?? [0, 0, 0], options.stroke);
  glyphPass(canvas, x2, y, text2, scale, options.color, 0);
}
function textMask(text2) {
  const width = text2.length * 6;
  const height = 9;
  const on = new Uint8Array(width * height);
  let cx = 0;
  for (const ch of text2) {
    const rows = GLYPHS.get(ch) ?? GLYPHS.get("?");
    rows?.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) if (row[rx] === "#") on[ry * width + cx + rx] = 1;
    });
    cx += 6;
  }
  return { width, height, on };
}

// packages/render/src/scene.ts
var AIR2 = "minecraft:air";
var WALL_DIRS = ["north", "south", "east", "west"];
var AO_NON_OCCLUDING = /* @__PURE__ */ new Set([
  "minecraft:ice",
  "minecraft:slime_block",
  "minecraft:honey_block"
]);
var SAME_TRANSLUCENT_BLOCKS = /* @__PURE__ */ new Set([
  "minecraft:glass",
  "minecraft:water",
  "minecraft:ice",
  "minecraft:slime_block",
  "minecraft:honey_block"
]);
var short2 = (name) => name.slice(name.indexOf(":") + 1);
var asObject3 = (v) => typeof v === "object" && v !== null && !Array.isArray(v) ? v : null;
var wallMemo = /* @__PURE__ */ new WeakMap();
function isWallBlock(name, assets) {
  if (assets === null) return false;
  let memo = wallMemo.get(assets);
  if (memo === void 0) {
    memo = /* @__PURE__ */ new Map();
    wallMemo.set(assets, memo);
  }
  const hit = memo.get(name);
  if (hit !== void 0) return hit;
  let result = false;
  const bs = asObject3(assets.readJson(`blockstates/${short2(name)}.json`));
  if (bs !== null) {
    const vals = /* @__PURE__ */ new Set();
    const collect = (when) => {
      const w = asObject3(when);
      if (w === null) return;
      if ("OR" in w) {
        for (const c of w.OR) collect(c);
        return;
      }
      if ("AND" in w) {
        for (const c of w.AND) collect(c);
        return;
      }
      for (const [k, v] of Object.entries(w)) {
        if (!WALL_DIRS.includes(k)) continue;
        if (Array.isArray(v)) for (const x2 of v) vals.add(String(x2));
        else vals.add(String(v));
      }
    };
    if (Array.isArray(bs.multipart)) for (const c of bs.multipart) collect(c.when);
    result = vals.size > 0 && [...vals].every((v) => v === "low" || v === "tall" || v === "false") && (vals.has("low") || vals.has("tall"));
  }
  memo.set(name, result);
  return result;
}
function blockOccludesAo(canonical2, assets) {
  const [name, props] = splitBlockstate(canonical2);
  if (name === AIR2) return false;
  if (Object.hasOwn(FLUID_RGBA, name)) return name === "minecraft:chest";
  if (assets === null) return true;
  const entity = tryEntityQuads(name, props, assets);
  if (entity !== null) return !name.endsWith("_banner");
  if (AO_NON_OCCLUDING.has(name)) return false;
  if (name.endsWith("leaves")) return true;
  if (isWallBlock(name, assets)) return false;
  const apps = modelApplications(name, props, assets);
  if (apps.length === 0) return true;
  try {
    const covered = new Uint8Array(16 * 16 * 16);
    const faceImages = [];
    for (const app of apps) {
      const model = modelElements(app.model, assets);
      if (model === null) return true;
      for (const el of model.elements) {
        const f = el.from.map((c) => Math.max(0, Math.min(16, pyRound(c))));
        const t = el.to.map((c) => Math.max(0, Math.min(16, pyRound(c))));
        for (let x2 = f[0]; x2 < t[0]; x2++) {
          for (let y = f[1]; y < t[1]; y++) {
            for (let z = f[2]; z < t[2]; z++)
              covered[(x2 * 16 + y) * 16 + z] = 1;
          }
        }
        for (const face of Object.values(asObject3(el.faces) ?? {})) {
          const v = String(asObject3(face)?.texture ?? "").replace(/^#+/, "");
          faceImages.push(model.images.get(v) ?? null);
        }
      }
    }
    if (covered.some((c) => c === 0)) return false;
    return faceImages.every((img) => img === null || img.channels !== 4);
  } catch {
    return true;
  }
}
var key = (x2, y, z) => `${x2},${y},${z}`;
function cellIndex2(d, x2, y, z) {
  const [sx, sy, sz] = d.size;
  if (x2 < 0 || y < 0 || z < 0 || x2 >= sx || y >= sy || z >= sz) return -1;
  return d.data[(x2 * sy + y) * sz + z];
}
function isHorizConnectorBlock(name) {
  const s = short2(name);
  const isPane = s === "glass_pane" || s.endsWith("_glass_pane");
  return s.endsWith("_fence") || isPane || name === "minecraft:iron_bars";
}
function paletteOcclusion(palette, assets) {
  return palette.map((b) => blockOccludesAo(b, assets));
}
function neighbourState(d, palette, nx, ny, nz) {
  const idx = cellIndex2(d, nx, ny, nz);
  if (idx < 0 || idx >= palette.length) return null;
  const block = palette[idx];
  return block === AIR2 ? null : { idx, block };
}
function buildWalls(d, occIdx, assets) {
  const out = /* @__PURE__ */ new Map();
  const [sx, sy, sz] = d.size;
  const wallIdx = /* @__PURE__ */ new Set();
  d.palette.forEach((b, i2) => {
    if (isWallBlock(splitBlockstate(b)[0], assets)) wallIdx.add(i2);
  });
  if (wallIdx.size === 0) return out;
  const connects = (nx, ny, nz) => {
    const n2 = neighbourState(d, d.palette, nx, ny, nz);
    if (n2 === null) return false;
    const [nname] = splitBlockstate(n2.block);
    if (isWallBlock(nname, assets)) return true;
    if (nname === "minecraft:iron_bars" || nname.endsWith("glass_pane")) return true;
    if (nname.endsWith("fence_gate")) return true;
    return occIdx[n2.idx];
  };
  for (let x2 = 0; x2 < sx; x2++) {
    for (let y = 0; y < sy; y++) {
      for (let z = 0; z < sz; z++) {
        if (!wallIdx.has(d.data[(x2 * sy + y) * sz + z])) continue;
        const entry = { aboveSolid: false, aboveAny: false };
        for (const dir of WALL_DIRS) {
          const [dx, dy, dz] = FACE_NORMALS[dir];
          entry[dir] = connects(x2 + dx, y + dy, z + dz);
        }
        if (y + 1 >= 0 && y + 1 < sy) {
          const a = neighbourState(d, d.palette, x2, y + 1, z);
          if (a !== null) {
            entry.aboveAny = true;
            entry.aboveSolid = occIdx[a.idx];
          }
        }
        out.set(key(x2, y, z), entry);
      }
    }
  }
  return out;
}
function buildConnectors(d, occIdx, assets) {
  const out = /* @__PURE__ */ new Map();
  const [sx, sy, sz] = d.size;
  const kinds = /* @__PURE__ */ new Map();
  d.palette.forEach((b, i2) => {
    const name = splitBlockstate(b)[0];
    if (isHorizConnectorBlock(name)) kinds.set(i2, short2(name).endsWith("_fence"));
  });
  if (kinds.size === 0) return out;
  const connects = (nx, ny, nz, isFence) => {
    const n2 = neighbourState(d, d.palette, nx, ny, nz);
    if (n2 === null) return false;
    const [nname] = splitBlockstate(n2.block);
    const ns = short2(nname);
    const nIsPane = ns === "glass_pane" || ns.endsWith("_glass_pane");
    if (isFence) {
      if (ns.endsWith("_fence") || ns.endsWith("_fence_gate")) return true;
    } else if (nIsPane || nname === "minecraft:iron_bars" || isWallBlock(nname, assets))
      return true;
    return occIdx[n2.idx];
  };
  for (let x2 = 0; x2 < sx; x2++) {
    for (let y = 0; y < sy; y++) {
      for (let z = 0; z < sz; z++) {
        const isFence = kinds.get(d.data[(x2 * sy + y) * sz + z]);
        if (isFence === void 0) continue;
        const entry = {};
        for (const dir of WALL_DIRS) {
          const [dx, dy, dz] = FACE_NORMALS[dir];
          entry[dir] = connects(x2 + dx, y + dy, z + dz, isFence);
        }
        out.set(key(x2, y, z), entry);
      }
    }
  }
  return out;
}
function prepareScene(dense, assets, knownOcc) {
  const occIdx = knownOcc ?? paletteOcclusion(dense.palette, assets);
  const [sx, sy, sz] = dense.size;
  const psz = [sx + 2, sy + 2, sz + 2];
  const occData = new Uint8Array(psz[0] * psz[1] * psz[2]);
  for (let x2 = 0; x2 < sx; x2++) {
    for (let y = 0; y < sy; y++) {
      for (let z = 0; z < sz; z++) {
        const idx = dense.data[(x2 * sy + y) * sz + z];
        if (idx >= 0 && occIdx[idx]) occData[((x2 + 1) * psz[1] + (y + 1)) * psz[2] + (z + 1)] = 1;
      }
    }
  }
  return {
    dense,
    assets,
    occIdx,
    occ: { size: psz, data: occData },
    walls: buildWalls(dense, occIdx, assets),
    connectors: buildConnectors(dense, occIdx, assets)
  };
}
function inferWallProps(block, x2, y, z, scene) {
  const [, explicit] = splitBlockstate(block);
  const entry = scene.walls.get(key(x2, y, z));
  const inferred = {};
  for (const d of WALL_DIRS) {
    if (Object.hasOwn(explicit, d)) continue;
    inferred[d] = !entry?.[d] ? "false" : entry.aboveSolid ? "tall" : "low";
  }
  if (!Object.hasOwn(explicit, "up")) {
    if (entry?.aboveAny) inferred.up = "true";
    else {
      const sides = WALL_DIRS.filter((d) => entry?.[d]).sort();
      const key2 = sides.join(",");
      inferred.up = key2 === "north,south" || key2 === "east,west" || key2 === "east,north,south,west" ? "false" : "true";
    }
  }
  if (!Object.hasOwn(explicit, "waterlogged")) inferred.waterlogged = "false";
  return inferred;
}
function inferConnectorProps(block, x2, y, z, scene) {
  const [, explicit] = splitBlockstate(block);
  const entry = scene.connectors.get(key(x2, y, z));
  const inferred = {};
  for (const d of WALL_DIRS) {
    if (Object.hasOwn(explicit, d)) continue;
    inferred[d] = entry?.[d] ? "true" : "false";
  }
  if (!Object.hasOwn(explicit, "waterlogged")) inferred.waterlogged = "false";
  return inferred;
}
function effectiveBlock(scene, x2, y, z) {
  const idx = cellIndex2(scene.dense, x2, y, z);
  if (idx < 0 || idx >= scene.dense.palette.length) return null;
  const block = scene.dense.palette[idx];
  if (block === AIR2) return null;
  const [name, explicit] = splitBlockstate(block);
  let inferred = null;
  if (isWallBlock(name, scene.assets)) inferred = inferWallProps(block, x2, y, z, scene);
  else if (isHorizConnectorBlock(name)) inferred = inferConnectorProps(block, x2, y, z, scene);
  if (inferred === null || Object.keys(inferred).length === 0) return block;
  const merged = { ...inferred, ...explicit };
  return `${name}[${Object.keys(merged).sort().map((k) => `${k}=${merged[k]}`).join(",")}]`;
}
function cellQuads(scene, x2, y, z, cache, fallbackBlocks = /* @__PURE__ */ new Set()) {
  const block = effectiveBlock(scene, x2, y, z);
  if (block === null) return null;
  let hit = cache.get(block);
  if (hit === void 0) {
    hit = blockQuads(block, scene.assets, fallbackBlocks);
    cache.set(block, hit);
  }
  return { ...hit, block };
}
var occAt = (g, x2, y, z) => g.data[(x2 * g.size[1] + y) * g.size[2] + z] === 1;
function isLeavesCell(scene, nx, ny, nz) {
  const idx = cellIndex2(scene.dense, nx, ny, nz);
  if (idx < 0 || idx >= scene.dense.palette.length) return false;
  return splitBlockstate(scene.dense.palette[idx])[0].endsWith("leaves");
}
function isSameTranslucentNeighbour(scene, name, nx, ny, nz) {
  if (!SAME_TRANSLUCENT_BLOCKS.has(name) && !name.endsWith("_stained_glass")) return false;
  const idx = cellIndex2(scene.dense, nx, ny, nz);
  if (idx < 0 || idx >= scene.dense.palette.length) return false;
  return splitBlockstate(scene.dense.palette[idx])[0] === name;
}
function quadCulledByNeighbour(scene, cull, x2, y, z, name) {
  if (cull === null) return false;
  const [nx, ny, nz] = [Math.trunc(x2 + cull[0]), Math.trunc(y + cull[1]), Math.trunc(z + cull[2])];
  if (occAt(scene.occ, nx + 1, ny + 1, nz + 1)) return !isLeavesCell(scene, nx, ny, nz);
  return isSameTranslucentNeighbour(scene, name, nx, ny, nz);
}
function quadAoLevels(vLocals, normal, cell, occ) {
  const ax = normal[0] ? 0 : normal[1] ? 1 : 2;
  const [t1, t2] = [0, 1, 2].filter((t) => t !== ax);
  const base = [cell[0] + normal[0] + 1, cell[1] + normal[1] + 1, cell[2] + normal[2] + 1];
  return vLocals.map((v) => {
    const o1 = v[t1] <= 1e-9 ? -1 : v[t1] >= 1 - 1e-9 ? 1 : 0;
    const o2 = v[t2] <= 1e-9 ? -1 : v[t2] >= 1 - 1e-9 ? 1 : 0;
    const i1 = [...base];
    i1[t1] = i1[t1] + o1;
    const i2 = [...base];
    i2[t2] = i2[t2] + o2;
    const ic = [...base];
    ic[t1] = ic[t1] + o1;
    ic[t2] = ic[t2] + o2;
    const s1 = occAt(occ, ...i1);
    const s2 = occAt(occ, ...i2);
    const c = occAt(occ, ...ic);
    return s1 && s2 ? 0 : 3 - (Number(s1) + Number(s2) + Number(c));
  });
}
function untrustedBlocks(dense, assets) {
  const out = /* @__PURE__ */ new Map();
  if (assets === null) return out;
  const counts = /* @__PURE__ */ new Map();
  for (const v of dense.data) if (v >= 0) counts.set(v, (counts.get(v) ?? 0) + 1);
  dense.palette.forEach((block, idx) => {
    if (block === AIR2) return;
    const [name] = splitBlockstate(block);
    if (isWallBlock(name, assets) || isHorizConnectorBlock(name)) return;
    if (blockQuads(block, assets, /* @__PURE__ */ new Set()).isFallback)
      out.set(name, (out.get(name) ?? 0) + (counts.get(idx) ?? 0));
  });
  return new Map([...out].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

// packages/render/src/rasterize.ts
var BG_PRESENTATION = [244, 241, 235];
var rgbOf = (hex) => [
  hex >> 16 & 255,
  hex >> 8 & 255,
  hex & 255
];
var PRESENTATION_LONGEST_PX = 2048;
var SUPERSAMPLE = 2;
var PRESENTATION_MARGIN = 0.35;
var AO_BRIGHTNESS = [0.4, 0.6, 0.8, 1];
function camera(view) {
  const th = view.azimuth * Math.PI / 180;
  const ph = view.elevation * Math.PI / 180;
  const d = [-Math.sin(th) * Math.cos(ph), -Math.sin(ph), Math.cos(th) * Math.cos(ph)];
  let r;
  if (Math.abs(d[1]) > 0.999) {
    r = [1, 0, 0];
  } else {
    const c = [d[1] * 0 - d[2] * 1, d[2] * 0 - d[0] * 0, d[0] * 1 - d[1] * 0];
    const n2 = Math.hypot(c[0], c[1], c[2]);
    r = [c[0] / n2, c[1] / n2, c[2] / n2];
  }
  const u = [r[1] * d[2] - r[2] * d[1], r[2] * d[0] - r[0] * d[2], r[0] * d[1] - r[1] * d[0]];
  return { d, r, u };
}
var dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
var project = (p, r, u) => [
  dot(p, r),
  dot(p, u)
];
function lstsq3(rows, b) {
  const ata = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  const atb = [0, 0, 0];
  rows.forEach(([c1, c2], i2) => {
    const a = [c1, c2, 1];
    for (let j = 0; j < 3; j++) {
      atb[j] += a[j] * b[i2];
      for (let k = 0; k < 3; k++)
        ata[j][k] += a[j] * a[k];
    }
  });
  const m = ata.map((row, i2) => [...row, atb[i2]]);
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++)
      if (Math.abs(m[r][col]) > Math.abs(m[piv][col]))
        piv = r;
    if (Math.abs(m[piv][col]) < 1e-12) return null;
    [m[col], m[piv]] = [m[piv], m[col]];
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const f = m[r][col] / m[col][col];
      for (let k = col; k < 4; k++)
        m[r][k] = m[r][k] - f * m[col][k];
    }
  }
  return [0, 1, 2].map(
    (i2) => m[i2][3] / m[i2][i2]
  );
}
function newCanvas(width, height, rgb) {
  const data = new Uint8Array(width * height * 3);
  for (let i2 = 0; i2 < width * height; i2++) data.set(rgb, i2 * 3);
  return { width, height, data };
}
var blend = (src, dst, m) => Math.floor((src * m + dst * (255 - m) + 127) / 255);
function polygonMask(pts, bw, bh) {
  const mask = new Uint8Array(bw * bh);
  const n2 = pts.length;
  for (let y = 0; y < bh; y++) {
    const yc = y + 0.5;
    const xs = [];
    for (let i2 = 0; i2 < n2; i2++) {
      const [x1, y1] = pts[i2];
      const [x2, y2] = pts[(i2 + 1) % n2];
      if (y1 <= yc && y2 > yc || y2 <= yc && y1 > yc)
        xs.push(x1 + (yc - y1) / (y2 - y1) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(
        0,
        Math.floor(xs[k] - 0.5 + 1e-9) + 1 - (Number.isInteger(xs[k] - 0.5) ? 1 : 0)
      );
      const to = Math.min(bw - 1, Math.floor(xs[k + 1] + 0.5 - 1e-9));
      for (let x2 = Math.max(0, from); x2 <= to; x2++) mask[y * bw + x2] = 255;
    }
  }
  return mask;
}
function drawTexturedQuad(canvas, pts, tex, ao) {
  const allOne = ao?.every((a2) => a2 === 1);
  const aoFactors = ao === null || allOne ? null : ao;
  let area2 = 0;
  for (let i2 = 0; i2 < 4; i2++) {
    const a2 = pts[i2];
    const b3 = pts[(i2 + 1) % 4];
    area2 += a2.sx * b3.sy - b3.sx * a2.sy;
  }
  if (Math.abs(area2) < 2) return;
  const src = pts.map((p) => [p.tx, p.ty]);
  const fx = lstsq3(
    src,
    pts.map((p) => p.sx)
  );
  const fy = lstsq3(
    src,
    pts.map((p) => p.sy)
  );
  if (fx === null || fy === null) return;
  const [m11, m12, t1] = fx;
  const [m21, m22, t2] = fy;
  const det = m11 * m22 - m12 * m21;
  if (Math.abs(det) < 1e-12) return;
  const inv = [m22 / det, -m12 / det, -m21 / det, m11 / det];
  const xs = pts.map((p) => p.sx);
  const ys = pts.map((p) => p.sy);
  const x0 = Math.floor(Math.min(...xs));
  const x1 = Math.ceil(Math.max(...xs));
  const y0 = Math.floor(Math.min(...ys));
  const y1 = Math.ceil(Math.max(...ys));
  const bw = x1 - x0;
  const bh = y1 - y0;
  if (bw < 1 || bh < 1) return;
  const a = inv[0];
  const b = inv[1];
  const c = a * (x0 - t1) + b * (y0 - t2);
  const d = inv[2];
  const e = inv[3];
  const f = d * (x0 - t1) + e * (y0 - t2);
  const mask = polygonMask(
    pts.map((p) => [p.sx - x0, p.sy - y0]),
    bw,
    bh
  );
  let brightFit = null;
  if (aoFactors !== null) {
    brightFit = lstsq3(
      pts.map((p) => [p.sx - x0, p.sy - y0]),
      aoFactors
    );
  }
  const ch = tex.channels;
  for (let oy = 0; oy < bh; oy++) {
    const cy = y0 + oy;
    if (cy < 0 || cy >= canvas.height) continue;
    for (let ox = 0; ox < bw; ox++) {
      const cx = x0 + ox;
      if (cx < 0 || cx >= canvas.width) continue;
      let cover = mask[oy * bw + ox];
      if (cover === 0) continue;
      const tx = Math.min(tex.width - 1, Math.max(0, Math.trunc(a * ox + b * oy + c)));
      const ty = Math.min(tex.height - 1, Math.max(0, Math.trunc(d * ox + e * oy + f)));
      const ti = (ty * tex.width + tx) * ch;
      let r = tex.data[ti];
      let g = tex.data[ti + 1];
      let bl = tex.data[ti + 2];
      if (brightFit !== null) {
        const k = Math.min(1, Math.max(0, brightFit[0] * ox + brightFit[1] * oy + brightFit[2]));
        r = Math.trunc(Math.fround(r) * Math.fround(k));
        g = Math.trunc(Math.fround(g) * Math.fround(k));
        bl = Math.trunc(Math.fround(bl) * Math.fround(k));
      }
      if (ch === 4) cover = Math.trunc(cover / 255 * (tex.data[ti + 3] / 255) * 255);
      if (cover === 0) continue;
      const di = (cy * canvas.width + cx) * 3;
      canvas.data[di] = blend(r, canvas.data[di], cover);
      canvas.data[di + 1] = blend(g, canvas.data[di + 1], cover);
      canvas.data[di + 2] = blend(bl, canvas.data[di + 2], cover);
    }
  }
}
function softShadow(canvas, foot) {
  const { width: W, height: H } = canvas;
  const xs = foot.map((p) => p[0]);
  const ys = foot.map((p) => p[1]);
  let cx = xs.reduce((a, b) => a + b, 0) / xs.length;
  let cy = ys.reduce((a, b) => a + b, 0) / ys.length;
  const rx = (Math.max(...xs) - Math.min(...xs)) * 0.52;
  const ry = (Math.max(...ys) - Math.min(...ys)) * 0.42 + rx * 0.12;
  cx += rx * 0.08;
  cy += ry * 0.18;
  const sigma = Math.max(8, Math.trunc(0.035 * Math.max(W, H)));
  const widths = boxWidths(sigma);
  const pad = widths.reduce((sum2, w) => sum2 + (w - 1) / 2, 0) + 2;
  const wx0 = Math.max(0, Math.floor(cx - rx - pad));
  const wy0 = Math.max(0, Math.floor(cy - ry - pad));
  const wx1 = Math.min(W, Math.ceil(cx + rx + pad));
  const wy1 = Math.min(H, Math.ceil(cy + ry + pad));
  const [ww, wh] = [wx1 - wx0, wy1 - wy0];
  if (ww <= 0 || wh <= 0) return;
  const alpha = new Float32Array(ww * wh);
  for (let y = Math.max(wy0, Math.floor(cy - ry)); y <= Math.min(wy1 - 1, Math.ceil(cy + ry)); y++) {
    for (let x2 = Math.max(wx0, Math.floor(cx - rx)); x2 <= Math.min(wx1 - 1, Math.ceil(cx + rx)); x2++) {
      const nx = (x2 + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) alpha[(y - wy0) * ww + (x2 - wx0)] = 95 / 255;
    }
  }
  let blurred = alpha;
  for (const width of widths)
    blurred = boxBlurAxis(boxBlurAxis(blurred, ww, wh, width, true), ww, wh, width, false);
  const shadowRgb = [40, 35, 30];
  for (let y = 0; y < wh; y++) {
    for (let x2 = 0; x2 < ww; x2++) {
      const a = Math.round(blurred[y * ww + x2] * 255);
      if (a === 0) continue;
      const i2 = ((y + wy0) * W + (x2 + wx0)) * 3;
      for (let c = 0; c < 3; c++)
        canvas.data[i2 + c] = blend(shadowRgb[c], canvas.data[i2 + c], a);
    }
  }
}
function boxWidths(sigma, n2 = 3) {
  const ideal = Math.sqrt(12 * sigma * sigma / n2 + 1);
  let wl = Math.floor(ideal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const m = Math.round((12 * sigma * sigma - n2 * wl * wl - 4 * n2 * wl - 3 * n2) / (-4 * wl - 4));
  return Array.from({ length: n2 }, (_, i2) => i2 < m ? wl : wu);
}
function boxBlurAxis(src, W, H, width, horizontal) {
  const out = new Float32Array(W * H);
  const r = (width - 1) / 2;
  const len = horizontal ? W : H;
  const lines = horizontal ? H : W;
  const step = horizontal ? 1 : W;
  const lineStep = horizontal ? W : 1;
  const inv = 1 / width;
  for (let l = 0; l < lines; l++) {
    const base = l * lineStep;
    let sum2 = 0;
    for (let i2 = 0; i2 <= Math.min(r, len - 1); i2++) sum2 += src[base + i2 * step];
    for (let i2 = 0; i2 < len; i2++) {
      out[base + i2 * step] = sum2 * inv;
      const add = i2 + r + 1;
      const drop = i2 - r;
      if (add < len) sum2 += src[base + add * step];
      if (drop >= 0) sum2 -= src[base + drop * step];
    }
  }
  return out;
}
var lanczos = (x2) => {
  if (x2 === 0) return 1;
  if (Math.abs(x2) >= 3) return 0;
  const px = Math.PI * x2;
  return 3 * Math.sin(px) * Math.sin(px / 3) / (px * px);
};
function resampleAxis(src, srcW, srcH, dstLen, horizontal) {
  const inLen = horizontal ? srcW : srcH;
  const scale = inLen / dstLen;
  const filterScale = Math.max(1, scale);
  const support = 3 * filterScale;
  const dstW = horizontal ? dstLen : srcW;
  const dstH = horizontal ? srcH : dstLen;
  const out = new Uint8Array(dstW * dstH * 3);
  const others = horizontal ? srcH : srcW;
  const inStep = horizontal ? 3 : srcW * 3;
  const inLine = horizontal ? srcW * 3 : 3;
  const outStep = horizontal ? 3 : dstW * 3;
  const outLine = horizontal ? dstW * 3 : 3;
  for (let i2 = 0; i2 < dstLen; i2++) {
    const center = (i2 + 0.5) * scale;
    const lo = Math.max(0, Math.trunc(center - support + 0.5));
    const hi = Math.min(inLen, Math.trunc(center + support + 0.5));
    const w = new Float64Array(hi - lo);
    let total2 = 0;
    for (let x2 = lo; x2 < hi; x2++) {
      const k = lanczos((x2 + 0.5 - center) / filterScale);
      w[x2 - lo] = k;
      total2 += k;
    }
    for (let j = 0; j < w.length; j++) w[j] = w[j] / total2;
    for (let o = 0; o < others; o++) {
      const inBase = o * inLine;
      const outBase = o * outLine + i2 * outStep;
      for (let c = 0; c < 3; c++) {
        let sum2 = 0;
        for (let x2 = lo; x2 < hi; x2++)
          sum2 += src[inBase + x2 * inStep + c] * w[x2 - lo];
        out[outBase + c] = Math.min(255, Math.max(0, Math.round(sum2)));
      }
    }
  }
  return out;
}
function downscaleLanczos(c, width, height) {
  const h = resampleAxis(c.data, c.width, c.height, width, true);
  return { width, height, data: resampleAxis(h, width, c.height, height, false) };
}
var TITLE_COLOR = [110, 105, 95];
function drawTitle(canvas, title) {
  const m = textMask(title);
  const pad = 2;
  const scale = Math.max(2, Math.trunc(canvas.width / 260));
  const [w, h] = [m.width + pad * 2, m.height + pad * 2];
  const left = Math.trunc((canvas.width - w * scale) / 2);
  const top = Math.trunc(canvas.height * 0.045);
  for (let y = 0; y < m.height; y++) {
    for (let x2 = 0; x2 < m.width; x2++) {
      if (!m.on[y * m.width + x2]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = left + (x2 + pad) * scale + dx;
          const py = top + (y + pad) * scale + dy;
          if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
          canvas.data.set(TITLE_COLOR, (py * canvas.width + px) * 3);
        }
      }
    }
  }
  void h;
}
function drawOverlay(canvas, view, r, u) {
  const { width: W, height: H } = canvas;
  const pad = 5;
  const [tw, th] = [textWidth(view.label, 11), 7];
  const [lx, ly] = [10, H - 10 - th - 2 * pad];
  fillRectAlpha(canvas, lx - pad, ly - pad, lx + tw + pad, ly + th + pad, [0, 0, 0], 160);
  drawText(canvas, lx, ly, view.label, { size: 11, color: [255, 255, 255] });
  const [sx, sy] = [-r[2], -u[2]];
  const [cx, cy, rad] = [W - 42, H - 42, 24];
  drawRingAlpha(canvas, cx, cy, rad, [255, 255, 255], 220, 2);
  const length = Math.hypot(sx, sy);
  const [nw, nh] = [textWidth("N", 11), 7];
  if (length > 1e-6) {
    const [dx, dy] = [sx / length, -sy / length];
    const [ex, ey] = [cx + dx * (rad - 6), cy + dy * (rad - 6)];
    drawLineAlpha(canvas, cx, cy, ex, ey, [255, 255, 255], 230, 2);
    drawText(canvas, Math.round(ex + dx * 10 - nw / 2), Math.round(ey + dy * 10 - nh / 2), "N", {
      size: 11,
      color: [255, 255, 255]
    });
  } else {
    drawText(canvas, Math.round(cx - nw / 2), Math.round(cy - nh / 2), "N", {
      size: 11,
      color: [255, 255, 255]
    });
  }
}
function renderableBounds(dense) {
  const air = dense.palette.indexOf("minecraft:air");
  const [sx, sy, sz] = dense.size;
  let lo = null;
  let hi = [0, 0, 0];
  for (let x2 = 0; x2 < sx; x2++) {
    for (let y = 0; y < sy; y++) {
      for (let z = 0; z < sz; z++) {
        const v = dense.data[(x2 * sy + y) * sz + z];
        if (v < 0 || v === air) continue;
        if (lo === null) {
          lo = [x2, y, z];
          hi = [x2 + 1, y + 1, z + 1];
        } else {
          lo = [Math.min(lo[0], x2), Math.min(lo[1], y), Math.min(lo[2], z)];
          hi = [Math.max(hi[0], x2 + 1), Math.max(hi[1], y + 1), Math.max(hi[2], z + 1)];
        }
      }
    }
  }
  return lo === null ? null : [
    [lo[0], hi[0]],
    [lo[1], hi[1]],
    [lo[2], hi[2]]
  ];
}
function renderView(dense, assets, view, options = {}) {
  const ss = options.supersample ?? SUPERSAMPLE;
  const longest = options.longestPx ?? PRESENTATION_LONGEST_PX;
  const margin = options.margin ?? PRESENTATION_MARGIN;
  const bg = options.background === void 0 ? BG_PRESENTATION : rgbOf(options.background);
  const crop2 = renderableBounds(dense);
  if (crop2 === null) {
    const empty = newCanvas(512, 512, bg);
    if (options.title) drawTitle(empty, options.title);
    return empty;
  }
  const scene = prepareScene(dense, assets);
  const { d, r, u } = camera(view);
  const [[x0, x1], [y0, y1], [z0, z1]] = crop2;
  const corners2 = [];
  for (const x2 of [x0, x1])
    for (const y of [y0, y1]) for (const z of [z0, z1]) corners2.push([x2, y, z]);
  const proj = corners2.map((p) => project(p, r, u));
  let minx = Math.min(...proj.map((p) => p[0]));
  let maxx = Math.max(...proj.map((p) => p[0]));
  let miny = Math.min(...proj.map((p) => p[1]));
  let maxy = Math.max(...proj.map((p) => p[1]));
  const mx = margin / 2 * (maxx - minx);
  const my = margin / 2 * (maxy - miny);
  minx -= mx;
  maxx += mx;
  miny -= my;
  maxy += my;
  if (options.title) miny -= (maxy - miny) * 0.16;
  const w2d = Math.max(maxx - minx, 1e-9);
  const h2d = Math.max(maxy - miny, 1e-9);
  const scale = longest / Math.max(w2d, h2d) * ss;
  const W = pyRound(w2d * scale);
  const H = pyRound(h2d * scale);
  const toPx = (sx, sy2) => [
    pyRound((sx - minx) * scale),
    pyRound((maxy - sy2) * scale)
  ];
  const canvas = newCanvas(W, H, bg);
  if (options.shadow ?? true) {
    const foot = [];
    for (const x2 of [x0, x1])
      for (const z of [z0, z1]) foot.push(toPx(...project([x2, y0, z], r, u)));
    softShadow(canvas, foot);
  }
  const cache = /* @__PURE__ */ new Map();
  const drawn = [];
  const [, sy, sz] = dense.size;
  let seq = 0;
  for (let x2 = x0; x2 < x1; x2++) {
    for (let y = y0; y < y1; y++) {
      for (let z = z0; z < z1; z++) {
        const idx = dense.data[(x2 * sy + y) * sz + z];
        if (idx < 0 || idx >= dense.palette.length || dense.palette[idx] === "minecraft:air")
          continue;
        const cell = cellQuads(scene, x2, y, z, cache);
        if (cell === null) continue;
        const name = splitBlockstate(dense.palette[idx])[0];
        for (const q2 of cell.quads) {
          if (dot(q2.normal, d) >= -1e-9) continue;
          if (quadCulledByNeighbour(scene, q2.cull, x2, y, z, name)) continue;
          const world = q2.points.map((p) => [p[0] + x2, p[1] + y, p[2] + z]);
          let depth = 0;
          for (const p of world)
            for (let i2 = 0; i2 < 3; i2++) depth += p[i2] * d[i2];
          drawn.push({
            depth: depth / 4,
            x: x2,
            y,
            z,
            seq: seq++,
            world,
            normal: q2.normal,
            tex: q2.image,
            flat: q2.flat
          });
        }
      }
    }
  }
  drawn.sort((a, b) => -a.depth - -b.depth || a.x - b.x || a.y - b.y || a.z - b.z || a.seq - b.seq);
  for (const q2 of drawn) {
    const th = q2.tex.height;
    const tw = q2.tex.width;
    const texCorners = [
      [0, 0],
      [0, th],
      [tw, th],
      [tw, 0]
    ];
    const verts = q2.world.map((p, i2) => {
      const [sx, sy2] = toPx(...project(p, r, u));
      return { sx, sy: sy2, tx: texCorners[i2]?.[0], ty: texCorners[i2]?.[1] };
    });
    let ao = null;
    if (!q2.flat) {
      const local = q2.world.map((p) => [p[0] - q2.x, p[1] - q2.y, p[2] - q2.z]);
      const levels = quadAoLevels(local, snapNormal(q2.normal), [q2.x, q2.y, q2.z], scene.occ);
      ao = levels.every((l) => l === 3) ? null : levels.map((l) => AO_BRIGHTNESS[l]);
    }
    drawTexturedQuad(canvas, verts, q2.tex, ao);
  }
  const finished = ss > 1 ? downscaleLanczos(canvas, Math.trunc(W / ss), Math.trunc(H / ss)) : canvas;
  if (options.title) drawTitle(finished, options.title);
  if (options.overlay ?? true) drawOverlay(finished, view, r, u);
  return finished;
}

// packages/render/src/views.ts
var MAX_VIEWS = 36;
var ViewError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ViewError";
  }
};
var GRAMMAR_HELP = "expected one of 'az<ddd>_el<dd>' (e.g. 'az045_el025'), 'orbit<n>_el<dd>' (e.g. 'orbit8_el25'), 'top', or 'iso'; multiple views are separated by semicolons";
var AZ_EL_RE = /^az:?(\d+)_el:?(\d+)$/;
var ORBIT_RE = /^orbit:?(\d+)_el:?(\d+)$/;
var q = (s) => s.includes("'") && !s.includes('"') ? `"${s}"` : `'${s.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
var pyFloat = (v) => Number.isInteger(v) ? v.toFixed(1) : String(v);
function fmtNum(value) {
  const rounded = Number(value.toFixed(3));
  if (Number.isInteger(rounded)) return String(rounded).padStart(3, "0");
  const [intPart, fracPart] = rounded.toFixed(3).replace(/0+$/, "").split(".");
  return `${intPart.padStart(3, "0")}.${fracPart}`;
}
var azElLabel = (azimuth, elevation) => `az${fmtNum(azimuth)}_el${fmtNum(elevation)}`;
function orbitViews(n2, elevation) {
  const views = [];
  for (let i2 = 0; i2 < n2; i2++) {
    const az = Number((i2 * 360 / n2).toFixed(9)) % 360;
    views.push({ azimuth: az, elevation, label: azElLabel(az, elevation) });
  }
  return views;
}
function checkCap(views) {
  if (views.length > MAX_VIEWS) {
    throw new ViewError(
      `too many views (${views.length} > ${MAX_VIEWS}): an agent will request 360 someday; keep it at ${MAX_VIEWS} or fewer`
    );
  }
  return views;
}
function parseToken(token) {
  if (token === "top") return [{ azimuth: 0, elevation: 90, label: "top" }];
  if (token === "iso") return [{ azimuth: 45, elevation: 35, label: "iso" }];
  let m = AZ_EL_RE.exec(token);
  if (m) {
    const az = Number(m[1]);
    const el = Number(m[2]);
    if (!(az >= 0 && az < 360)) {
      throw new ViewError(
        `malformed view token ${q(token)}: azimuth ${pyFloat(az)} out of range [0, 360); ${GRAMMAR_HELP}`
      );
    }
    if (!(el >= 0 && el <= 90)) {
      throw new ViewError(
        `malformed view token ${q(token)}: elevation ${pyFloat(el)} out of range [0, 90]; ${GRAMMAR_HELP}`
      );
    }
    return [{ azimuth: az, elevation: el, label: azElLabel(az, el) }];
  }
  m = ORBIT_RE.exec(token);
  if (m) {
    const n2 = Number(m[1]);
    const el = Number(m[2]);
    if (n2 < 1)
      throw new ViewError(
        `malformed view token ${q(token)}: orbit count must be >= 1; ${GRAMMAR_HELP}`
      );
    if (!(el >= 0 && el <= 90)) {
      throw new ViewError(
        `malformed view token ${q(token)}: elevation ${pyFloat(el)} out of range [0, 90]; ${GRAMMAR_HELP}`
      );
    }
    return orbitViews(n2, el);
  }
  throw new ViewError(`malformed view token ${q(token)}: ${GRAMMAR_HELP}`);
}
function parseViews(spec) {
  const views = [];
  for (const raw of spec.split(";")) {
    const token = pyStrip(raw);
    if (token === "")
      throw new ViewError(`malformed view token ${q(token)} (empty): ${GRAMMAR_HELP}`);
    views.push(...parseToken(token));
  }
  return checkCap(views);
}
var defaultViews = () => parseViews("orbit8_el25;top");
function withCount(views, n2) {
  if (n2 <= 0) throw new RangeError(`count must be positive, got ${n2}`);
  return checkCap([...views, ...orbitViews(n2, 25)]);
}
function resolveViews(spec) {
  if (spec === null || spec === void 0) return defaultViews();
  if (typeof spec === "string") return parseViews(spec);
  const items = [...spec];
  if (items.length > 0 && items.every((v) => typeof v === "string"))
    return parseViews(items.join(";"));
  return checkCap(items);
}

// packages/render/src/node/assets.ts
var import_pngjs = __toESM(require_png(), 1);
import { existsSync, readFileSync } from "node:fs";
import { join as join2 } from "node:path";
function directoryAssets(root) {
  const textures = /* @__PURE__ */ new Map();
  return {
    readJson(path) {
      try {
        return JSON.parse(readFileSync(join2(root, path), "utf8"));
      } catch {
        return null;
      }
    },
    texture(id, options) {
      const firstFrameOnly = options?.firstFrameOnly ?? true;
      const cacheKey = firstFrameOnly ? id : `${id}#strip`;
      if (textures.has(cacheKey)) return textures.get(cacheKey);
      let img = null;
      try {
        const png = import_pngjs.PNG.sync.read(readFileSync(join2(root, "textures", `${id}.png`)));
        img = fromRgba(png.width, png.height, new Uint8Array(png.data));
        const meta = join2(root, "textures", `${id}.png.mcmeta`);
        if (firstFrameOnly && existsSync(meta)) {
          try {
            const m = JSON.parse(readFileSync(meta, "utf8"));
            if (typeof m.animation === "object" && m.animation !== null && img.height > img.width && img.height % img.width === 0) {
              img = crop(img, 0, 0, img.width, img.width);
            }
          } catch {
          }
        }
      } catch {
        img = null;
      }
      textures.set(cacheKey, img);
      return img;
    }
  };
}
function encodePng(canvas) {
  const png = new import_pngjs.PNG({ width: canvas.width, height: canvas.height });
  for (let i2 = 0; i2 < canvas.width * canvas.height; i2++) {
    png.data[i2 * 4] = canvas.data[i2 * 3];
    png.data[i2 * 4 + 1] = canvas.data[i2 * 3 + 1];
    png.data[i2 * 4 + 2] = canvas.data[i2 * 3 + 2];
    png.data[i2 * 4 + 3] = 255;
  }
  return new Uint8Array(import_pngjs.PNG.sync.write(png));
}

// node_modules/.pnpm/smol-toml@1.9.1/node_modules/smol-toml/dist/error.js
function getLineColFromPtr(string2, ptr) {
  let lines = string2.slice(0, ptr).split(/\r?\n/);
  return [lines.length, lines.pop().length + 1];
}
function makeCodeBlock(string2, line2, column) {
  let lines = string2.split(/\r?\n/);
  let codeblock = "";
  let numberLen = (Math.log10(line2 + 1) | 0) + 1;
  for (let i2 = line2 - 1; i2 <= line2 + 1; i2++) {
    let l = lines[i2 - 1];
    if (!l)
      continue;
    codeblock += i2.toString().padEnd(numberLen, " ");
    codeblock += ":  ";
    codeblock += l;
    codeblock += "\n";
    if (i2 === line2) {
      codeblock += " ".repeat(numberLen + column + 2);
      codeblock += "^\n";
    }
  }
  return codeblock;
}
var TomlError = class _TomlError extends Error {
  line;
  column;
  codeblock;
  constructor(message, options) {
    const [line2, column] = getLineColFromPtr(options.toml, options.ptr);
    const codeblock = makeCodeBlock(options.toml, line2, column);
    super(`Invalid TOML document: ${message}

${codeblock}`, options);
    this.line = line2;
    this.column = column;
    this.codeblock = codeblock;
  }
  /** @internal */
  static x(message, ctx, ptr) {
    throw new _TomlError(message, { toml: ctx.s, ptr: ptr ?? ctx.p });
  }
};

// node_modules/.pnpm/smol-toml@1.9.1/node_modules/smol-toml/dist/primitive.js
function parseString(ctx) {
  let startPtr = ctx.p;
  let c = ctx.s.charCodeAt(ctx.p++);
  let first = c;
  let isLiteral = c === 39;
  let isMultiline = c === ctx.s.charCodeAt(ctx.p) && c === ctx.s.charCodeAt(ctx.p + 1);
  if (isMultiline) {
    if ((c = ctx.s.charCodeAt(ctx.p += 2)) === 10)
      ctx.p++;
    else if (c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10)
      ctx.p += 2;
  }
  let parsed = "";
  let sliceStart = ctx.p;
  let state = 0;
  for (; ctx.p < ctx.s.length; ctx.p++) {
    c = ctx.s.charCodeAt(ctx.p);
    if (isMultiline && (c === 10 || c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10)) {
      state = state && 3;
    } else if (c < 32 && c !== 9 || c === 127) {
      TomlError.x("control characters are not allowed in strings", ctx);
    } else if ((!state || state === 3) && c === first && (!isMultiline || ctx.s.charCodeAt(ctx.p + 1) === first && ctx.s.charCodeAt(ctx.p + 2) === first)) {
      if (isMultiline) {
        if (ctx.s.charCodeAt(ctx.p + 3) === first)
          ctx.p++;
        if (ctx.s.charCodeAt(ctx.p + 3) === first)
          ctx.p++;
      }
      if (!state) {
        let s = ctx.s.slice(sliceStart, ctx.p);
        parsed = parsed ? parsed + s : s;
      }
      ctx.p += isMultiline ? 3 : 1;
      return parsed;
    } else if (!state) {
      if (!isLiteral && c === 92) {
        parsed += ctx.s.slice(sliceStart, sliceStart = ctx.p);
        state = 1;
      }
    } else if (state === 1) {
      if (c === 120 || c === 117 || c === 85) {
        let errPtr = ctx.p++ - 1;
        let value = 0;
        let len = c === 120 ? 2 : c === 117 ? 4 : 8;
        for (let j = 0; j < len; j++, ctx.p++) {
          let hex = ctx.s.charCodeAt(ctx.p);
          let digit = (
            /* 0-9 */
            hex >= 48 && hex <= 57 ? hex - 48 : (
              /* A-F */
              hex >= 65 && hex <= 70 ? hex - 65 + 10 : (
                /* a-f */
                hex >= 97 && hex <= 102 ? hex - 97 + 10 : -1
              )
            )
          );
          if (digit < 0)
            TomlError.x("invalid non-hex character in unicode escape", ctx);
          value = value << 4 | digit;
        }
        if (value < 0 || value > 1114111 || value >= 55296 && value <= 57343) {
          TomlError.x("invalid unicode escape", ctx, errPtr);
        }
        parsed += String.fromCodePoint(value);
        sliceStart = ctx.p--;
        state = 0;
      } else if (isMultiline && (c === 32 || c === 9)) {
        state = 2;
      } else {
        if (c === 98)
          parsed += "\b";
        else if (c === 116)
          parsed += "	";
        else if (c === 110)
          parsed += "\n";
        else if (c === 102)
          parsed += "\f";
        else if (c === 114)
          parsed += "\r";
        else if (c === 101)
          parsed += "\x1B";
        else if (c === 34)
          parsed += '"';
        else if (c === 92)
          parsed += "\\";
        else
          TomlError.x("unrecognised escape sequence", ctx);
        sliceStart = ctx.p + 1;
        state = 0;
      }
    } else if (c !== 32 && c !== 9) {
      if (state === 2)
        TomlError.x("invalid escape: only line-ending whitespace may be escaped", ctx, sliceStart);
      state = !isLiteral && c === 92 ? 1 : 0;
      sliceStart = ctx.p;
    }
  }
  TomlError.x("unfinished string", ctx, startPtr);
}

// node_modules/.pnpm/smol-toml@1.9.1/node_modules/smol-toml/dist/date.js
var DATE_TIME_RE = /^(\d{4}-\d{2}-\d{2})?[Tt ]?(?:(\d{2}):\d{2}(?::\d{2}(?:\.\d+)?)?)?(Z|z|[-+]\d{2}:\d{2})?$/i;
var TomlDate = class _TomlDate extends Date {
  #hasDate = false;
  #hasTime = false;
  #offset = null;
  constructor(date, fasttype, unsafeDelim) {
    let hasDate = true;
    let hasTime = true;
    let offset = "Z";
    let c;
    if (typeof date === "string") {
      if (fasttype)
        prep: {
          if (fasttype < 3) {
            if (+date.slice(11, 13) > 23) {
              date = "";
              break prep;
            }
            if (fasttype === 2) {
              offset = null;
              date += "Z";
            } else if ((c = date.charCodeAt(date.length - 1)) !== 90 && c !== 122) {
              offset = date.slice(date.length - 6);
            }
            if (unsafeDelim)
              date = date.slice(0, 10) + "T" + date.slice(11);
          } else if (fasttype === 4) {
            date = +date.slice(0, 2) > 23 ? "" : `0000-01-01T${date}Z`;
          }
          hasDate = fasttype !== 4;
          hasTime = fasttype !== 3;
        }
      else {
        let match = date.match(DATE_TIME_RE);
        if (match) {
          if (!match[1]) {
            hasDate = false;
            date = `0000-01-01T${date}`;
          }
          hasTime = !!match[2];
          hasTime && date[10] === " " && (date = date.replace(" ", "T"));
          if (match[2] && +match[2] > 23) {
            date = "";
          } else {
            offset = match[3] || null;
            if (!offset && hasTime)
              date += "Z";
          }
        } else {
          date = "";
        }
      }
    }
    super(date);
    if (!isNaN(this.getTime())) {
      this.#hasDate = hasDate;
      this.#hasTime = hasTime;
      this.#offset = offset;
    }
  }
  isDateTime() {
    return this.#hasDate && this.#hasTime;
  }
  isLocal() {
    return !this.#hasDate || !this.#hasTime || !this.#offset;
  }
  isDate() {
    return this.#hasDate && !this.#hasTime;
  }
  isTime() {
    return this.#hasTime && !this.#hasDate;
  }
  isValid() {
    return this.#hasDate || this.#hasTime;
  }
  toISOString() {
    let iso = super.toISOString();
    if (this.isDate())
      return iso.slice(0, 10);
    if (this.isTime())
      return iso.slice(11, 23);
    if (this.#offset === null)
      return iso.slice(0, -1);
    if (this.#offset === "Z" || this.#offset === "z")
      return iso;
    let offset = +this.#offset.slice(1, 3) * 60 + +this.#offset.slice(4, 6);
    offset = this.#offset[0] === "-" ? offset : -offset;
    let offsetDate = new Date(this.getTime() - offset * 6e4);
    return offsetDate.toISOString().slice(0, -1) + this.#offset;
  }
  static wrapAsOffsetDateTime(jsDate, offset = "Z") {
    let date = new _TomlDate(jsDate);
    date.#offset = offset;
    return date;
  }
  static wrapAsLocalDateTime(jsDate) {
    let date = new _TomlDate(jsDate);
    date.#offset = null;
    return date;
  }
  static wrapAsLocalDate(jsDate) {
    let date = new _TomlDate(jsDate);
    date.#hasTime = false;
    date.#offset = null;
    return date;
  }
  static wrapAsLocalTime(jsDate) {
    let date = new _TomlDate(jsDate);
    date.#hasDate = false;
    date.#offset = null;
    return date;
  }
};

// node_modules/.pnpm/smol-toml@1.9.1/node_modules/smol-toml/dist/extract.js
function isDigit(char, base = 10) {
  return base === 16 ? char > 47 && char < 58 || char > 64 && char < 71 || char > 96 && char < 103 : char > 47 && char < 48 + base;
}
function isEndOfValue(char, delim) {
  return char === 32 || char === 9 || char === 10 || char === 13 || // Structure end or next value delimiter
  delim && (char === delim || char === 44) || // Comment
  char === 35;
}
function extractValue(ctx, end) {
  let errPtr = ctx.p;
  let c = ctx.s.charCodeAt(ctx.p);
  if (c === 91 || c === 123) {
    ctx.d-- || TomlError.x("document contains excessively nested structures. aborting.", ctx);
    let value = c === 91 ? parseArray(ctx) : parseInlineTable(ctx);
    ctx.d++;
    return value;
  }
  if (c === 34 || c === 39) {
    return parseString(ctx);
  }
  if (c === 116) {
    if (ctx.s.charCodeAt(++ctx.p) !== 114 || ctx.s.charCodeAt(++ctx.p) !== 117 || ctx.s.charCodeAt(++ctx.p) !== 101)
      TomlError.x("invalid value", ctx, errPtr);
    return ctx.p++, true;
  }
  if (c === 102) {
    if (ctx.s.charCodeAt(++ctx.p) !== 97 || ctx.s.charCodeAt(++ctx.p) !== 108 || ctx.s.charCodeAt(++ctx.p) !== 115 || ctx.s.charCodeAt(++ctx.p) !== 101)
      TomlError.x("invalid value", ctx, errPtr);
    return ctx.p++, false;
  }
  if (c === 43 || c === 45) {
    return parseNumber(ctx, ctx.p, ctx.s.charCodeAt(++ctx.p), 44 - c, end);
  }
  if (ctx.s.charCodeAt(ctx.p + 4) === 45 && ctx.s.charCodeAt(ctx.p + 7) === 45) {
    return parseDate(ctx, c, end);
  }
  if (ctx.s.charCodeAt(ctx.p + 2) === 58) {
    return parseTime(ctx, c, end);
  }
  return parseNumber(ctx, ctx.p, c, 0, end);
}
function parseNumber(ctx, startPtr, startChr, sign, endChr) {
  let c = startChr;
  let state = 0;
  let hasUnderscores = false;
  if (c === 105) {
    if (ctx.s.charCodeAt(++ctx.p) !== 110 || ctx.s.charCodeAt(++ctx.p) !== 102)
      TomlError.x("invalid value", ctx, startPtr);
    return ctx.p++, (sign || 1) / 0;
  }
  if (c === 110) {
    if (ctx.s.charCodeAt(++ctx.p) !== 97 || ctx.s.charCodeAt(++ctx.p) !== 110)
      TomlError.x("invalid value", ctx, startPtr);
    return ctx.p++, NaN;
  }
  if (c === 48) {
    if (++ctx.p >= ctx.s.length || isEndOfValue(c = ctx.s.charCodeAt(ctx.p), endChr))
      return ctx.bi === true ? 0n : 0;
    if (!sign) {
      if (c === 120)
        return parseIntegerBaseN(ctx, startPtr, 16, endChr);
      else if (c === 98)
        return parseIntegerBaseN(ctx, startPtr, 2, endChr);
      else if (c === 111)
        return parseIntegerBaseN(ctx, startPtr, 8, endChr);
    }
    if (c === 46)
      state = 2;
    else if (c === 101 || c === 69)
      state = 4;
    else
      TomlError.x("illegal leading zero", ctx, startPtr);
  } else if (!isDigit(c))
    TomlError.x("invalid value", ctx, startPtr);
  while (++ctx.p < ctx.s.length && (c = ctx.s.charCodeAt(ctx.p), !isEndOfValue(c, endChr))) {
    if (!state)
      state = 1;
    if (c === 95) {
      if (!(state & 1))
        TomlError.x("illegal underscore", ctx);
      state += 11;
      hasUnderscores = true;
    } else if (state === 1 && c === 46)
      state = 2;
    else if ((state === 1 || state === 3) && (c === 101 || c === 69))
      state = 4;
    else if (state === 4 && (c === 43 || c === 45)) {
      state = 6;
    } else if (!isDigit(c))
      TomlError.x(`illegal character in numeric literal`, ctx);
    else if (state > 9)
      state -= 11;
    else if (!(state & 1))
      state++;
  }
  if (!state) {
    let val = (startChr - 48) * (sign || 1);
    return ctx.bi === true ? BigInt(val) : val;
  }
  if (!(state & 1))
    TomlError.x("unfinished numeric value", ctx, startPtr);
  let str2 = ctx.s.slice(startPtr, ctx.p);
  if (hasUnderscores)
    str2 = str2.replaceAll("_", "");
  return state > 1 ? parseFloat(str2) : parseInteger(ctx, str2, 10, startPtr);
}
function parseIntegerBaseN(ctx, startPtr, base, endChr) {
  let c, underscore = 1;
  while (++ctx.p < ctx.s.length && (c = ctx.s.charCodeAt(ctx.p), !isEndOfValue(c, endChr))) {
    if (c === 95) {
      if (underscore & 1)
        TomlError.x("illegal underscore", ctx);
      underscore = 3;
    } else if (!isDigit(c, base))
      TomlError.x(`illegal character in numeric literal`, ctx);
    else if (underscore & 1)
      underscore--;
  }
  if (underscore & 1)
    TomlError.x("unfinished numeric value", ctx);
  let str2 = ctx.s.slice(startPtr + 2, ctx.p);
  if (underscore)
    str2 = str2.replaceAll("_", "");
  return parseInteger(ctx, str2, base, startPtr);
}
function parseInteger(ctx, str2, base, startPtr) {
  if (ctx.bi !== true)
    int: {
      let val = parseInt(str2, base);
      if (!Number.isSafeInteger(val)) {
        if (ctx.bi)
          break int;
        TomlError.x("integer value cannot be represented losslessly", ctx, startPtr);
      }
      return val;
    }
  return base === 10 ? BigInt(str2) : BigInt((base === 2 ? "0b" : base === 8 ? "0o" : "0x") + str2);
}
function parseDate(ctx, c, endChr) {
  let startPtr = ctx.p++, unsafeSeparator;
  if (!isDigit(c) || !isDigit(ctx.s.charCodeAt(ctx.p++)) || !isDigit(ctx.s.charCodeAt(ctx.p++)) || !isDigit(ctx.s.charCodeAt(ctx.p++))) {
    return parseNumber(ctx, ctx.p = startPtr, c, 0, endChr);
  }
  ctx.p += 5;
  if (!isDigit(ctx.s.charCodeAt(ctx.p++)))
    TomlError.x("invalid date-time: date part is malformed", ctx, startPtr);
  if (ctx.p >= ctx.s.length || ((c = ctx.s.charCodeAt(ctx.p)) !== 32 || (unsafeSeparator = true, !isDigit(ctx.s.charCodeAt(ctx.p + 1)))) && c !== 84 && c !== 116) {
    let t2 = ctx.s.slice(startPtr, ctx.p);
    return readDate(ctx, t2, 3, false, startPtr);
  }
  if (ctx.s.charCodeAt(ctx.p += 3) !== 58)
    TomlError.x("invalid date-time: time part is malformed", ctx, startPtr);
  if (ctx.s.charCodeAt(ctx.p += 3) === 58)
    ctx.p += 3;
  if (ctx.s.charCodeAt(ctx.p) === 46)
    while (isDigit(ctx.s.charCodeAt(++ctx.p)))
      ;
  if (c = ctx.s.charCodeAt(ctx.p)) {
    if (c === 90 || c === 122) {
      let t2 = ctx.s.slice(startPtr, ++ctx.p);
      return readDate(ctx, t2, 1, unsafeSeparator, startPtr, "[+00:00]");
    }
    if (c === 43 || c === 45) {
      let t2 = ctx.s.slice(startPtr, ctx.p += 6);
      return readDate(ctx, t2, 1, unsafeSeparator, startPtr, !ctx.ld && "[" + ctx.s.slice(ctx.p - 6, ctx.p) + "]");
    }
  }
  let t = ctx.s.slice(startPtr, ctx.p);
  return readDate(ctx, t, 2, unsafeSeparator, startPtr);
}
function parseTime(ctx, c, endChr) {
  let start = ctx.p;
  if (!isDigit(c) || !isDigit(ctx.s.charCodeAt(++ctx.p))) {
    return parseNumber(ctx, --ctx.p, c, 0, endChr);
  }
  if (ctx.s.charCodeAt(ctx.p += 4) === 58)
    ctx.p += 3;
  if (ctx.s.charCodeAt(ctx.p) === 46)
    while (isDigit(ctx.s.charCodeAt(++ctx.p)))
      ;
  let t = ctx.s.slice(start, ctx.p);
  return readDate(ctx, t, 4, false, start);
}
function readDate(ctx, str2, type, unsafeDelim, errPtr, temporalSuffix) {
  if (ctx.ld) {
    let date = new TomlDate(str2, type, unsafeDelim);
    if (!date.isValid())
      TomlError.x("invalid date", ctx, errPtr);
    return date;
  }
  try {
    if (temporalSuffix)
      str2 += temporalSuffix;
    switch (type) {
      case 1:
        return Temporal.ZonedDateTime.from(str2);
      case 2:
        return Temporal.PlainDateTime.from(str2);
      case 3:
        return Temporal.PlainDate.from(str2);
      case 4:
        return Temporal.PlainTime.from(str2);
    }
  } catch (e) {
    TomlError.x(e instanceof Error ? e.message : "" + e, ctx, errPtr);
  }
}

// node_modules/.pnpm/smol-toml@1.9.1/node_modules/smol-toml/dist/util.js
function skipComment(ctx) {
  for (; ctx.p < ctx.s.length; ctx.p++) {
    let c = ctx.s.charCodeAt(ctx.p);
    if (c === 10)
      break;
    if (c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10) {
      ctx.p++;
      break;
    }
    if (c < 32 && c !== 9 || c === 127) {
      TomlError.x("control characters are not allowed in comments", ctx);
    }
  }
}
function skipVoid(ctx, banNewLines, banComments) {
  let c;
  while (ctx.p < ctx.s.length) {
    while (ctx.p < ctx.s.length && ((c = ctx.s.charCodeAt(ctx.p)) === 32 || c === 9 || !banNewLines && (c === 10 || c === 13 && ctx.s.charCodeAt(ctx.p + 1) === 10)))
      ctx.p++;
    if (banComments || c !== 35)
      break;
    skipComment(ctx);
  }
}

// node_modules/.pnpm/smol-toml@1.9.1/node_modules/smol-toml/dist/struct.js
function parseKey(ctx, end = 61) {
  let startPtr;
  let state = 0;
  let parsed = [];
  let sliceStart;
  let c = ctx.s.charCodeAt(startPtr = ctx.p);
  do {
    if (c === end) {
      if (!state)
        TomlError.x("unexpected end of key", ctx);
      if (state === 1)
        parsed.push(ctx.s.slice(sliceStart, ctx.p));
      return ctx.p++, parsed;
    } else if (c === 46) {
      if (!state)
        TomlError.x("illegal empty bare key", ctx);
      if (state === 1)
        parsed.push(ctx.s.slice(sliceStart, ctx.p));
      state = 0;
    } else if (!state && (c === 34 || c === 39)) {
      if (c === ctx.s.charCodeAt(ctx.p + 1) && c === ctx.s.charCodeAt(ctx.p + 2))
        TomlError.x("illegal quoted key: multiline strings are not allowed", ctx);
      parsed.push(parseString(ctx));
      state = 2;
      ctx.p--;
    } else if (c === 32 || c === 9) {
      if (state === 1) {
        parsed.push(ctx.s.slice(sliceStart, ctx.p));
        state = 2;
      }
    } else if (state === 2 || c < 48 && c !== 45 || c > 57 && c < 65 || c > 90 && c < 97 && c !== 95 || c > 122) {
      TomlError.x("illegal character in key", ctx);
    } else if (!state) {
      state = 1;
      sliceStart = ctx.p;
    }
  } while (c = ctx.s.charCodeAt(++ctx.p));
  TomlError.x("incomplete key-value: cannot find end of key", ctx, startPtr);
}
function parseInlineTable(ctx) {
  let startPtr = ctx.p++;
  let res = /* @__PURE__ */ Object.create(null);
  let seen = /* @__PURE__ */ new Set();
  let c;
  while (ctx.p < ctx.s.length) {
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p)) === 125) {
      ctx.p++;
      return res;
    }
    let k;
    let t = res;
    let hasOwn = false;
    let errPtr = ctx.p;
    let key2 = parseKey(ctx);
    for (let i2 = 0; i2 < key2.length; i2++) {
      if (i2)
        t = hasOwn ? t[k] : t[k] = /* @__PURE__ */ Object.create(null);
      k = key2[i2];
      if ((hasOwn = Object.hasOwn(t, k)) && (typeof t[k] !== "object" || seen.has(t[k]))) {
        TomlError.x("trying to redefine an already defined value", ctx, errPtr);
      }
      let unsafe = k === "__proto__";
      if (ctx.uk && (unsafe || k === "constructor")) {
        t = ctx.uk !== 1 && TomlError.x("document contains an unsafe property", ctx, errPtr);
        break;
      }
      if (!hasOwn && unsafe) {
        Object.defineProperty(t, k, { enumerable: true, configurable: true, writable: true });
      }
    }
    if (hasOwn) {
      TomlError.x("trying to redefine an already defined value", ctx, errPtr);
    }
    skipVoid(ctx, true, true);
    let value = extractValue(
      ctx,
      125
      /* } */
    );
    if (t && typeof (t[k] = value) === "object")
      seen.add(value);
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p++)) === 125) {
      return res;
    }
    if (c !== 44)
      TomlError.x("expected comma or end of structure", ctx, ctx.p - 1);
  }
  TomlError.x("unfinished table", ctx, startPtr);
}
function parseArray(ctx) {
  let startPtr = ctx.p++;
  let res = [];
  let c;
  while (ctx.p < ctx.s.length) {
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p)) === 93) {
      ctx.p++;
      return res;
    }
    res.push(extractValue(
      ctx,
      93
      /* ] */
    ));
    skipVoid(ctx);
    if ((c = ctx.s.charCodeAt(ctx.p++)) === 93) {
      return res;
    }
    if (c !== 44)
      TomlError.x("expected comma or end of structure", ctx, ctx.p - 1);
  }
  TomlError.x("unfinished array", ctx, startPtr);
}

// node_modules/.pnpm/smol-toml@1.9.1/node_modules/smol-toml/dist/parse.js
function peekTable(ctx, key2, table, meta, type) {
  let t = table;
  let m = meta;
  let k;
  let hasOwn = false;
  let state;
  for (let i2 = 0; i2 < key2.length; i2++) {
    if (i2) {
      t = hasOwn ? t[k] : t[k] = /* @__PURE__ */ Object.create(null);
      m = (state = m[k]).c;
      if (type === 0 && (state.t === 1 || state.t === 2)) {
        return null;
      }
      if (state.t === 2) {
        let l = t.length - 1;
        t = t[l];
        m = m[l].c;
      }
    }
    k = key2[i2];
    if ((hasOwn = Object.hasOwn(t, k)) && m[k]?.t === 0 && m[k]?.d) {
      return null;
    }
    if (!hasOwn) {
      let unsafe = k === "__proto__";
      if (ctx.uk && (unsafe || k === "constructor"))
        return false;
      if (unsafe) {
        Object.defineProperty(t, k, { enumerable: true, configurable: true, writable: true });
        Object.defineProperty(m, k, { enumerable: true, configurable: true, writable: true });
      }
      m[k] = {
        t: i2 < key2.length - 1 && type === 2 ? 3 : type,
        d: false,
        i: 0,
        c: /* @__PURE__ */ Object.create(null)
      };
    }
  }
  state = m[k];
  if (state.t !== type && !(type === 1 && state.t === 3)) {
    return null;
  }
  if (type === 2) {
    if (!state.d) {
      state.d = true;
      t[k] = [];
    }
    t[k].push(t = /* @__PURE__ */ Object.create(null));
    state.c[state.i++] = state = { t: 1, d: false, i: 0, c: /* @__PURE__ */ Object.create(null) };
  }
  if (state.d) {
    return null;
  }
  state.d = true;
  if (type === 1) {
    t = hasOwn ? t[k] : t[k] = /* @__PURE__ */ Object.create(null);
  } else if (type === 0 && hasOwn) {
    return null;
  }
  return [k, t, state.c];
}
function validateTablePeek(ctx, peek, ptr) {
  if (peek === null || ctx.uk === 2)
    TomlError.x(peek === null ? "trying to redefine an already defined table or value" : "document contains an unsafe property", ctx, ptr);
}
function parse2(toml, options = {}) {
  let ctx = {
    s: toml,
    p: 0,
    d: options.maxDepth ?? 1e3,
    bi: options.integersAsBigInt ?? false,
    ld: options.useLegacyDate ?? true,
    uk: options.unsafeKeyBehaviour === "throw" ? 2 : options.unsafeKeyBehaviour === "drop" ? 1 : 0
  };
  let res = /* @__PURE__ */ Object.create(null);
  let meta = /* @__PURE__ */ Object.create(null);
  let tmp;
  let skipping = false;
  let tbl = res;
  let m = meta;
  if (toml.charCodeAt(0) === 65279)
    ctx.p++;
  skipVoid(ctx);
  while (ctx.p < toml.length) {
    if (toml.charCodeAt(ctx.p) === 91) {
      let isTableArray = toml.charCodeAt(++ctx.p) === 91;
      tmp = ctx.p += +isTableArray;
      skipping = false;
      let k = parseKey(
        ctx,
        93
        /* ] */
      );
      if (isTableArray) {
        if (toml.charCodeAt(ctx.p) !== 93) {
          TomlError.x("expected end of table array declaration", ctx);
        }
        ctx.p++;
      }
      let p = peekTable(
        ctx,
        k,
        res,
        meta,
        isTableArray ? 2 : 1
        /* Type.EXPLICIT */
      );
      if (!p) {
        validateTablePeek(ctx, p, tmp);
        skipping = true;
      } else {
        m = p[2];
        tbl = p[1];
      }
    } else {
      tmp = ctx.p;
      let k = parseKey(ctx);
      let p = peekTable(
        ctx,
        k,
        tbl,
        m,
        0
        /* Type.DOTTED */
      );
      if (!p && !skipping)
        validateTablePeek(ctx, p, tmp);
      skipVoid(ctx, true, true);
      let v = extractValue(ctx, void 0);
      if (p && !skipping)
        p[1][p[0]] = v;
    }
    skipVoid(ctx, true);
    if (ctx.p < toml.length && (tmp = toml.charCodeAt(ctx.p)) !== 10 && (tmp !== 13 || toml.charCodeAt(ctx.p + 1) !== 10)) {
      TomlError.x("each key-value declaration must be followed by an end-of-line", ctx);
    }
    skipVoid(ctx);
  }
  return res;
}

// node_modules/.pnpm/smol-toml@1.9.1/node_modules/smol-toml/dist/stringify.js
var HAS_WELLFORMED = !!"".isWellFormed;

// packages/mcbuilder/src/config.ts
var ConfigError = class extends McbuilderError {
};
var DEFAULT_MAX_DIMENSIONS = [256, 256, 256];
function pyInt(v) {
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("not finite");
    return Math.trunc(v);
  }
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && /^\s*[+-]?\d+\s*$/.test(v)) return Number.parseInt(v, 10);
  throw new Error("not an integer");
}
function expandUser(path, home) {
  if (path === "~") return home;
  if (path.startsWith("~/")) return `${home.replace(/\/$/, "")}/${path.slice(2)}`;
  return path;
}
function parseConfig(text2, options = {}) {
  const source = options.source ?? "mcbuild.toml";
  let data;
  try {
    data = parse2(text2);
  } catch (e) {
    throw new ConfigError(`invalid TOML in ${source}: ${e.message}`);
  }
  const mcVersion = data.mc_version ?? "26.2";
  if (typeof mcVersion !== "string" || mcVersion === "") {
    throw new ConfigError("mc_version must be a non-empty string");
  }
  const rawDims = data.max_dimensions ?? [...DEFAULT_MAX_DIMENSIONS];
  let dims;
  try {
    if (!Array.isArray(rawDims)) throw new Error("not a list");
    dims = rawDims.map(pyInt);
  } catch {
    throw new ConfigError(
      `max_dimensions must be a list of 3 integers, got ${JSON.stringify(rawDims)}`
    );
  }
  if (dims.length !== 3 || dims.some((d) => d <= 0)) {
    throw new ConfigError(
      `max_dimensions must be 3 positive integers, got ${JSON.stringify(rawDims)}`
    );
  }
  const allowlist = data.allowlist ?? [];
  if (!Array.isArray(allowlist) || !allowlist.every((a) => typeof a === "string")) {
    throw new ConfigError(`allowlist must be a list of strings, got ${JSON.stringify(allowlist)}`);
  }
  let assetsDir = null;
  if (data.assets_dir !== void 0) {
    if (typeof data.assets_dir !== "string") {
      throw new ConfigError(
        `assets_dir must be a string path, got ${JSON.stringify(data.assets_dir)}`
      );
    }
    assetsDir = options.home === void 0 ? data.assets_dir : expandUser(data.assets_dir, options.home);
  }
  return {
    mcVersion,
    maxDimensions: dims,
    allowlist: [...allowlist],
    assetsDir
  };
}
function resolveAssetsDir(config, home) {
  return config.assetsDir ?? `${home.replace(/\/$/, "")}/.cache/mcbuilder/${config.mcVersion}`;
}

// packages/mcbuilder/src/dataversion.ts
var ExportError = class extends McbuilderError {
};
var DATA_VERSIONS = {
  "26.2": 4903,
  "26.1": 4786,
  "1.21.11": 4671,
  "1.21.4": 4189,
  "1.21.1": 3955
};
function resolveDataVersion(mcVersion, versionJson) {
  const wv = versionJson?.world_version;
  if (typeof wv === "number" && Number.isInteger(wv)) return wv;
  const known = Object.hasOwn(DATA_VERSIONS, mcVersion) ? DATA_VERSIONS[mcVersion] : void 0;
  if (known === void 0) {
    throw new ExportError(
      `unknown DataVersion for MC version '${mcVersion}': run \`mcbuild assets fetch --version ${mcVersion}\` first so the client jar's version.json can supply it`
    );
  }
  return known;
}

// packages/mcbuilder/src/diff.ts
var DiffError = class extends McbuilderError {
};
var voxelKey = (x2, y, z) => `${x2},${y},${z}`;
var posOf = (key2) => key2.split(",").map(Number);
var isEmpty = (d) => d.added.length + d.removed.length + d.changed.length === 0;
var total = (d) => d.added.length + d.removed.length + d.changed.length;
var cmpPos = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
function diffVoxelMaps(a, b) {
  const keys = [.../* @__PURE__ */ new Set([...a.keys(), ...b.keys()])].map((k) => ({ key: k, pos: posOf(k) }));
  keys.sort((p, q2) => cmpPos(p.pos, q2.pos));
  const out = { added: [], removed: [], changed: [], cellsA: a.size, cellsB: b.size };
  for (const { key: key2, pos } of keys) {
    const inA = a.has(key2);
    const inB = b.has(key2);
    if (inA && !inB) out.removed.push([pos, a.get(key2)]);
    else if (inB && !inA) out.added.push([pos, b.get(key2)]);
    else if (a.get(key2) !== b.get(key2))
      out.changed.push([pos, a.get(key2), b.get(key2)]);
  }
  return out;
}
function n(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`;
}
function formatDiff(diff, aId, bId, options = {}) {
  const maxEntries = options.maxEntries ?? 30;
  const lines = [`diff ${aId} -> ${bId}`];
  if (isEmpty(diff)) {
    lines.push(`  no differences (${n(diff.cellsA, "cell")} in both)`);
    return lines.join("\n");
  }
  lines.push(
    `  ${n(total(diff), "changed cell")}: ${diff.added.length} added, ${diff.removed.length} removed, ${diff.changed.length} replaced (${diff.cellsA} -> ${diff.cellsB} cells)`
  );
  const entries2 = [
    ...diff.added.map(([pos, blk]) => ["+", pos, blk, null]),
    ...diff.removed.map(([pos, blk]) => [
      "-",
      pos,
      blk,
      null
    ]),
    ...diff.changed.map(([pos, o, nw]) => ["~", pos, o, nw])
  ];
  const shown = Math.min(entries2.length, Math.max(0, maxEntries));
  for (const [sym, pos, old, nw] of entries2.slice(0, Math.max(0, maxEntries))) {
    const xyz2 = pos.join(", ");
    lines.push(nw === null ? `  ${sym} (${xyz2}) ${old}` : `  ~ (${xyz2}) ${old} -> ${nw}`);
  }
  const rest = entries2.length - shown;
  if (rest) lines.push(`  ... ${n(rest, "more change")} not shown (use --max N)`);
  return lines.join("\n");
}

// packages/mcbuilder/src/guide.ts
var AIR3 = "minecraft:air";
var BG = [246, 243, 236];
var GRID = [200, 194, 182];
var GRID_MAJOR = [150, 144, 132];
var INK = [40, 38, 34];
var MAX_GRID_PX = 1400;
var LEGEND_W = 330;
var SECOND_HALF = [
  ["half", "upper"],
  ["part", "head"]
];
function itemOf(block) {
  const [name, props] = splitBlockstate(block);
  if (name === AIR3) return null;
  if (SECOND_HALF.some(([k, v]) => props[k] === v)) return null;
  if (props.type === "double" && name.endsWith("_slab")) return [name, 2];
  return [name, 1];
}
function itemCounts(blocks) {
  const out = /* @__PURE__ */ new Map();
  for (const b of blocks) {
    const item = itemOf(b);
    if (item) out.set(item[0], (out.get(item[0]) ?? 0) + item[1]);
  }
  return out;
}
function mostCommon(counts) {
  return [...counts].sort((a, b) => b[1] - a[1]);
}
function stacks(n2) {
  const s = Math.floor(n2 / 64);
  const r = n2 % 64;
  if (!s) return String(n2);
  return `${s}×64${r ? ` + ${r}` : ""}`;
}
var shortName = (name) => name.startsWith("minecraft:") ? name.slice("minecraft:".length) : name;
var titleCase = (s) => s.replace(/[A-Za-z]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
var ARROW = {
  north: [0, -1],
  south: [0, 1],
  east: [1, 0],
  west: [-1, 0]
};
function marker(canvas, x0, y0, c, props) {
  const [cx, cy] = [x0 + c / 2, y0 + c / 2];
  const facing = props.facing;
  if (facing !== void 0 && Object.hasOwn(ARROW, facing)) {
    const [dx, dy] = ARROW[facing];
    const tip = [cx + dx * c * 0.36, cy + dy * c * 0.36];
    const back = [cx - dx * c * 0.18, cy - dy * c * 0.18];
    const [px, py] = [-dy * c * 0.2, dx * c * 0.2];
    drawPolygon(
      canvas,
      [tip, [back[0] + px, back[1] + py], [back[0] - px, back[1] - py]],
      [255, 255, 255],
      [0, 0, 0]
    );
  } else if (facing === "up" || facing === "down") {
    const r = c * 0.14;
    drawEllipse(
      canvas,
      cx - r,
      cy - r,
      cx + r,
      cy + r,
      facing === "up" ? [255, 255, 255] : [0, 0, 0],
      facing === "up" ? [0, 0, 0] : [255, 255, 255]
    );
  }
  const axis = props.axis;
  if (axis === "x" || axis === "z") {
    const w = c * 0.36;
    if (axis === "x")
      drawRect(canvas, cx - w, cy - 1.5, cx + w, cy + 1.5, [255, 255, 255], [0, 0, 0]);
    else drawRect(canvas, cx - 1.5, cy - w, cx + 1.5, cy + w, [255, 255, 255], [0, 0, 0]);
  }
  if (props.half === "top" || props.type === "top") {
    drawText(canvas, x0 + 2, y0 + 1, "T", {
      size: Math.max(8, Math.trunc(c * 0.38)),
      color: [255, 255, 255],
      stroke: 2,
      strokeColor: [0, 0, 0]
    });
  }
}
function topTextures(palette, assets) {
  const out = /* @__PURE__ */ new Map();
  palette.forEach((block, idx) => {
    if (block !== AIR3) out.set(idx, buildFaceTextures(block, assets, /* @__PURE__ */ new Set()).up);
  });
  return out;
}
function layerImage(dense, y, textures, title) {
  const [sx, sy, sz] = dense.size;
  const cell = (x2, yy, z) => dense.data[(x2 * sy + yy) * sz + z];
  const c = Math.max(10, Math.min(28, Math.floor(MAX_GRID_PX / Math.max(sx, sz))));
  const [top, left] = [96, 44];
  const [gw, gh] = [sx * c, sz * c];
  const layerBlocks = [];
  for (let x2 = 0; x2 < sx; x2++)
    for (let z = 0; z < sz; z++) {
      const i2 = cell(x2, y, z);
      if (i2 >= 0) layerBlocks.push(dense.palette[i2]);
    }
  const counts = itemCounts(layerBlocks);
  const width = Math.max(left + gw + 20 + LEGEND_W, 720);
  let height = Math.max(top + gh + 30, top + 40);
  height = Math.max(height, top + 30 + counts.size * 24 + 20);
  const img = createCanvas(width, height, BG);
  drawText(img, left, 16, title, { size: 22, color: INK });
  drawText(
    img,
    left,
    46,
    "north is up  |  x: east (right)  |  z: south (down)  |  arrow: facing  |  T: top half  |  faded: layer below",
    {
      size: 13,
      color: [110, 104, 96]
    }
  );
  const tiles = /* @__PURE__ */ new Map();
  for (const [i2, t] of textures) tiles.set(i2, resizeNearest(t, c, c));
  const ghosts = /* @__PURE__ */ new Map();
  for (const [i2, t] of tiles) ghosts.set(i2, blendToward(t, BG, 0.75));
  for (let x2 = 0; x2 < sx; x2++) {
    for (let z = 0; z < sz; z++) {
      const [px, pz] = [left + x2 * c, top + z * c];
      const idx = cell(x2, y, z);
      if (idx >= 0 && dense.palette[idx] !== AIR3) {
        pasteRgb(img, tiles.get(idx), px, pz);
      } else if (y > 0) {
        const b = cell(x2, y - 1, z);
        if (b >= 0 && dense.palette[b] !== AIR3) pasteRgb(img, ghosts.get(b), px, pz);
      }
    }
  }
  for (let x2 = 0; x2 < sx; x2++) {
    for (let z = 0; z < sz; z++) {
      const idx = cell(x2, y, z);
      if (idx >= 0 && dense.palette[idx] !== AIR3)
        marker(img, left + x2 * c, top + z * c, c, splitBlockstate(dense.palette[idx])[1]);
    }
  }
  for (let i2 = 0; i2 <= sx; i2++)
    drawLine2(img, left + i2 * c, top, left + i2 * c, top + gh, i2 % 5 === 0 ? GRID_MAJOR : GRID);
  for (let k = 0; k <= sz; k++)
    drawLine2(img, left, top + k * c, left + gw, top + k * c, k % 5 === 0 ? GRID_MAJOR : GRID);
  for (let i2 = 0; i2 < sx; i2 += 5)
    drawText(img, left + i2 * c + 2, top - 14, String(i2), { size: 11, color: INK });
  for (let k = 0; k < sz; k += 5)
    drawText(img, 6, top + k * c + 2, String(k), { size: 11, color: INK });
  const lx = left + gw + 20;
  let ly = top;
  drawText(img, lx, ly - 24, "this layer", { size: 14, color: INK });
  const nameToIdx = /* @__PURE__ */ new Map();
  dense.palette.forEach((b, idx) => {
    const n2 = splitBlockstate(b)[0];
    if (!nameToIdx.has(n2)) nameToIdx.set(n2, idx);
  });
  for (const [name, n2] of mostCommon(counts)) {
    const idx = nameToIdx.get(name);
    const tile = idx === void 0 ? void 0 : tiles.get(idx);
    if (tile) pasteRgb(img, resizeNearest(tile, 18, 18), lx, ly);
    drawText(img, lx + 26, ly + 2, `${String(n2).padStart(4)}  ${shortName(name)}`, {
      size: 13,
      color: INK
    });
    ly += 24;
  }
  return { image: img, counts };
}
function buildGuide(dense, assets, options = {}) {
  const title = options.title ?? "Build guide";
  const [sx, sy, sz] = dense.size;
  const textures = topTextures(dense.palette, assets);
  const filled = (y) => {
    for (let x2 = 0; x2 < sx; x2++) {
      for (let z = 0; z < sz; z++) {
        const i2 = dense.data[(x2 * sy + y) * sz + z];
        if (i2 >= 0 && dense.palette[i2] !== AIR3) return true;
      }
    }
    return false;
  };
  const layers = [];
  for (let y = 0; y < sy; y++) if (filled(y)) layers.push(y);
  const everything = [];
  for (const i2 of dense.data) if (i2 >= 0) everything.push(dense.palette[i2]);
  const total2 = itemCounts(everything);
  const sum2 = [...total2.values()].reduce((a, b) => a + b, 0);
  const md = [`# ${title}`, ""];
  if (options.cover) md.push(`![${title}](${options.cover})`, "");
  md.push(
    `Size: **${sx} × ${sy} × ${sz}** (x × y × z), ${layers.length} layers, ${sum2} items.`,
    "",
    "Coordinates count from the north-west bottom corner: x to the east, z to the south, layer 1 at the bottom. In each plan the faded blocks are the layer below.",
    "",
    "## Materials",
    "",
    "| Item | Count | Stacks |",
    "|---|---:|---:|"
  );
  for (const [n2, k] of mostCommon(total2)) md.push(`| ${shortName(n2)} | ${k} | ${stacks(k)} |`);
  md.push("");
  const out = [];
  layers.forEach((y, i2) => {
    const step = i2 + 1;
    const name = `layer-${String(step).padStart(2, "0")}.png`;
    const { image, counts } = layerImage(
      dense,
      y,
      textures,
      `Layer ${step} of ${layers.length}   (y = ${y})`
    );
    const common = mostCommon(counts);
    out.push({ name, image, counts: common });
    md.push(
      `## Layer ${step} (y = ${y})`,
      "",
      `![Layer ${step}](${name})`,
      "",
      common.map(([n2, k]) => `${k} ${shortName(n2)}`).join(", "),
      ""
    );
  });
  return { markdown: md.join("\n"), layers: out };
}

// packages/mcbuilder/src/importer.ts
function structureFromVolume(volume, source, meta = {}) {
  const cells = [];
  volume.eachCell((x2, y, z, idx) => {
    cells.push([x2, y, z, volume.palette[idx]]);
  });
  cells.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  return {
    blocks: cells,
    source,
    dataVersion: meta.dataVersion ?? null,
    droppedBlockEntities: meta.droppedBlockEntities ?? 0,
    droppedEntities: meta.droppedEntities ?? 0,
    droppedProperties: /* @__PURE__ */ new Map()
  };
}
var AIR4 = "minecraft:air";
function cleanProperties(structure, registry) {
  const cache = /* @__PURE__ */ new Map();
  const dropped = new Map(structure.droppedProperties);
  const blocks = structure.blocks.map(([x2, y, z, b]) => {
    let hit = cache.get(b);
    if (hit === void 0) {
      const bracket = b.indexOf("[");
      const name = bracket === -1 ? b : b.slice(0, bracket);
      const rest = bracket === -1 ? "" : b.slice(bracket + 1);
      const legal = Object.hasOwn(registry.blocks, name) ? registry.blocks[name] : void 0;
      if (legal === void 0 || rest === "") {
        hit = { state: b, dropped: [] };
      } else {
        const props = /* @__PURE__ */ new Map();
        for (const kv of rest.replace(/\]+$/, "").split(",")) {
          const eq = kv.indexOf("=");
          if (eq !== -1) props.set(kv.slice(0, eq), kv.slice(eq + 1));
        }
        const keep = /* @__PURE__ */ new Map();
        const gone = [];
        for (const [k, v] of props) {
          if (Object.hasOwn(legal, k) && legal[k].includes(v)) keep.set(k, v);
          else gone.push(`${localName(name)}.${k}`);
        }
        const kept = [...keep.keys()].sort(compareCodePoints).map((k) => `${k}=${keep.get(k)}`);
        hit = {
          state: canonicalize(kept.length > 0 ? `${name}[${kept.join(",")}]` : name),
          dropped: gone
        };
      }
      cache.set(b, hit);
    }
    for (const k of hit.dropped) dropped.set(k, (dropped.get(k) ?? 0) + 1);
    return [x2, y, z, hit.state];
  });
  return { ...structure, blocks, droppedProperties: dropped };
}
function pyFixed(x2, digits) {
  const exact = Math.abs(x2).toFixed(Math.min(100, digits + 25));
  const dot2 = exact.indexOf(".");
  const tail = exact.slice(dot2 + 1 + digits);
  if (/^50*$/.test(tail)) {
    const kept = exact.slice(0, dot2 + 1 + digits);
    const lastDigit = Number(kept.replace(".", "").slice(-1));
    const rounded = lastDigit % 2 === 0 ? kept : (Math.abs(x2) + 0.5 * 10 ** -digits).toFixed(digits);
    return (x2 < 0 ? "-" : "") + (digits === 0 ? rounded.replace(/\.$/, "") : rounded);
  }
  return x2.toFixed(digits);
}
var nameOf = (block) => block.split("[", 1)[0];
var localName = (name) => name.slice(name.indexOf(":") + 1);
function summary(structure, top = 25) {
  const blocks = structure.blocks;
  if (blocks.length === 0) return ["empty structure"];
  const dims = [0, 1, 2].map((i2) => Math.max(...blocks.map((b) => b[i2])) + 1);
  const byName = /* @__PURE__ */ new Map();
  for (const [, , , b] of blocks) {
    if (b === AIR4) continue;
    byName.set(nameOf(b), (byName.get(nameOf(b)) ?? 0) + 1);
  }
  const solid = [...byName.values()].reduce((a, b) => a + b, 0);
  const states = new Set(blocks.map((b) => b[3])).size;
  const lines = [
    `source: ${structure.source}${structure.dataVersion ? ` (DataVersion ${structure.dataVersion})` : ""}`,
    `size: ${dims[0]} x ${dims[1]} x ${dims[2]} (x * y * z), ${solid} blocks, ${byName.size} block types, ${states} block states`
  ];
  if (structure.droppedBlockEntities || structure.droppedEntities) {
    lines.push(
      `not imported: ${structure.droppedBlockEntities} block-entity data (chest contents, signs...), ${structure.droppedEntities} entities`
    );
  }
  if (structure.droppedProperties.size > 0) {
    const items = [...structure.droppedProperties].sort((a, b) => compareCodePoints(a[0], b[0]));
    lines.push(
      `dropped unknown properties (Bedrock leftovers?): ${items.map(([k, n2]) => `${k} x${n2}`).join(", ")}`
    );
  }
  lines.push("", `top block types (of ${byName.size}):`);
  const ranked = [...byName].sort((a, b) => b[1] - a[1]).slice(0, top);
  for (const [name, n2] of ranked) {
    lines.push(
      `  ${String(n2).padStart(6)}  ${pyFixed(100 * n2 / solid, 1).padStart(5)}%  ${localName(name)}`
    );
  }
  const perLayer = /* @__PURE__ */ new Map();
  for (const [, y, , b] of blocks) if (b !== AIR4) perLayer.set(y, (perLayer.get(y) ?? 0) + 1);
  lines.push(
    "",
    `blocks per layer (y): ${Array.from({ length: dims[1] }, (_, y) => `${y}:${perLayer.get(y) ?? 0}`).join(", ")}`
  );
  return lines;
}
function mergeBoxes(cells) {
  const key2 = (x2, y, z) => `${x2},${y},${z}`;
  const left = new Set(cells.map(([x2, y, z]) => key2(x2, y, z)));
  const order = [...cells].sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[0] - b[0]);
  const boxes = [];
  for (const [x0, y0, z0] of order) {
    if (!left.has(key2(x0, y0, z0))) continue;
    let x1 = x0;
    while (left.has(key2(x1 + 1, y0, z0))) x1++;
    let z1 = z0;
    const rowFull = (z, y) => {
      for (let x2 = x0; x2 <= x1; x2++) if (!left.has(key2(x2, y, z))) return false;
      return true;
    };
    while (rowFull(z1 + 1, y0)) z1++;
    let y1 = y0;
    const layerFull = (y) => {
      for (let z = z0; z <= z1; z++) if (!rowFull(z, y)) return false;
      return true;
    };
    while (layerFull(y1 + 1)) y1++;
    for (let x2 = x0; x2 <= x1; x2++)
      for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) left.delete(key2(x2, y, z));
    boxes.push([
      [x0, y0, z0],
      [x1, y1, z1]
    ]);
  }
  return boxes;
}
var ABBREV = {
  north: "N",
  south: "S",
  east: "E",
  west: "W",
  true: "T",
  false: "F"
};
var PY_KEYWORDS = new Set(
  "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield".split(
    " "
  )
);
function constName(block, taken) {
  const bracket = block.indexOf("[");
  const base = bracket === -1 ? block : block.slice(0, bracket);
  const props = bracket === -1 ? "" : block.slice(bracket + 1);
  const name = localName(base).toUpperCase();
  const parts = [];
  for (const kv of props.replace(/\]+$/, "").split(",")) {
    const eq = kv.indexOf("=");
    if (eq === -1) continue;
    const k = kv.slice(0, eq);
    const v = kv.slice(eq + 1);
    if (k === "waterlogged" && v === "false") continue;
    parts.push((ABBREV[v] ?? v).toUpperCase());
  }
  let cand = [name, ...parts].join("_").replace(/[^A-Z0-9_]/g, "_");
  if (/^[0-9]/.test(cand) || PY_KEYWORDS.has(cand.toLowerCase())) cand = `B_${cand}`;
  let out = cand;
  let n2 = 2;
  while (taken.has(out)) {
    out = `${cand}_${n2}`;
    n2++;
  }
  taken.add(out);
  return out;
}
function planImport(structure) {
  const counts = /* @__PURE__ */ new Map();
  const byBlock = /* @__PURE__ */ new Map();
  for (const [x2, y, z, b] of structure.blocks) {
    counts.set(b, (counts.get(b) ?? 0) + 1);
    const list2 = byBlock.get(b);
    if (list2) list2.push([x2, y, z]);
    else byBlock.set(b, [[x2, y, z]]);
  }
  const taken = /* @__PURE__ */ new Set();
  const names = /* @__PURE__ */ new Map();
  const order = [...counts.keys()].sort(
    (a, b) => counts.get(b) - counts.get(a) || compareCodePoints(a, b)
  );
  for (const b of order) names.set(b, constName(b, taken));
  const calls = [];
  for (const [block, cells] of byBlock) {
    for (const [c1, c2] of mergeBoxes(cells))
      calls.push({ y: c1[1], z: c1[2], x: c1[0], c1, c2, block });
  }
  calls.sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
  return { names, counts, calls };
}
function toScript(structure, options = {}) {
  const { names, counts, calls } = planImport(structure);
  const comment = [
    `Imported from ${structure.source} by \`mcbuild import\`.`,
    "",
    ...summary(structure)
  ].concat(["", "Coordinates: x east, y up, z south; (0, 0, 0) is the north-west bottom corner."]).map((l) => l === "" ? " *" : ` * ${l}`);
  const out = [
    "/**",
    ...comment,
    " */",
    'import { Build } from "@voxwright/mcbuilder";',
    "",
    `export const BUILD = new Build({ seed: ${options.seed ?? 0}, views: "iso;az200_el025;top" });`,
    "",
    "// block states, most used first",
    ...[...names].map(([b, n2]) => `const ${n2} = ${JSON.stringify(b)}; // ${counts.get(b)}`),
    "",
    "BUILD.scope(() => {"
  ];
  let layer = null;
  for (const c of calls) {
    if (c.y !== layer) {
      out.push("", `  // --- layer y = ${c.y} ---`);
      layer = c.y;
    }
    const name = names.get(c.block);
    const same = c.c1[0] === c.c2[0] && c.c1[1] === c.c2[1] && c.c1[2] === c.c2[2];
    out.push(
      same ? `  BUILD.set(${c.c1[0]}, ${c.c1[1]}, ${c.c1[2]}, ${name});` : `  BUILD.box([${c.c1.join(", ")}], [${c.c2.join(", ")}], ${name});`
    );
  }
  out.push("});", "");
  return out.join("\n");
}

// packages/mcbuilder/src/pyrepr.ts
function pyRepr(s) {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += `\\${ch}`;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "	") out += "\\t";
    else if (cp < 32 || cp === 127) out += `\\x${cp.toString(16).padStart(2, "0")}`;
    else out += ch;
  }
  return quote + out + quote;
}
var pyReprList = (items) => `[${items.map(pyRepr).join(", ")}]`;

// packages/mcbuilder/src/registry.ts
var AIR5 = "minecraft:air";
var RegistryError = class extends McbuilderError {
};
function normalizeBlockData(raw) {
  if (Array.isArray(raw)) {
    const blocks = {};
    for (const entry of raw) {
      const props = {};
      for (const state of entry.states ?? []) {
        let values = state.values;
        if (values === void 0 || values === null) {
          values = state.type === "bool" ? ["true", "false"] : [];
        }
        props[state.name] = values.map(String);
      }
      blocks[`minecraft:${entry.name}`] = { properties: props };
    }
    return blocks;
  }
  const mapping = raw?.blocks;
  if (typeof mapping === "object" && mapping !== null && !Array.isArray(mapping)) {
    const blocks = {};
    for (const [name, info] of Object.entries(
      mapping
    )) {
      const props = {};
      for (const [p, vals] of Object.entries(info?.properties ?? {})) props[p] = vals.map(String);
      blocks[name] = { properties: props };
    }
    return blocks;
  }
  throw new McbuilderError(
    'unrecognized registry data: expected a minecraft-data blocks.json list or a {"blocks": {...}} mapping'
  );
}
var BlockSyntaxError = class extends Error {
};
var BLOCK_RE = /^([^[{]+)(?:\[([^\]]*)\])?(\{.*\})?$/s;
function splitBlock(block) {
  const match = BLOCK_RE.exec(pyStrip(block));
  if (!match) throw new BlockSyntaxError(`malformed block string: ${pyRepr(block)}`);
  const name = pyStrip(match[1]);
  if (name === "")
    throw new BlockSyntaxError(`malformed block string (empty name): ${pyRepr(block)}`);
  const props = /* @__PURE__ */ new Map();
  if (match[2] !== void 0) {
    for (const raw of match[2].split(",")) {
      const part = pyStrip(raw);
      if (part === "") continue;
      const eq = part.indexOf("=");
      if (eq === -1) {
        throw new BlockSyntaxError(
          `malformed property ${pyRepr(part)} in ${pyRepr(block)} (want name=value)`
        );
      }
      props.set(pyStrip(part.slice(0, eq)), pyStrip(part.slice(eq + 1)));
    }
  }
  return { name, props, nbt: match[3] ?? null };
}
function nbtBalanced(nbt) {
  const closers = { "}": "{", "]": "[", ")": "(" };
  const stack = [];
  let i2 = 0;
  const n2 = nbt.length;
  while (i2 < n2) {
    const ch = nbt[i2];
    if (ch === '"' || ch === "'") {
      i2++;
      while (i2 < n2 && nbt[i2] !== ch) {
        if (nbt[i2] === "\\") i2++;
        i2++;
      }
      i2++;
      continue;
    }
    if ("{[(".includes(ch)) stack.push(ch);
    else if (ch in closers) {
      if (stack.length === 0 || stack.pop() !== closers[ch]) return false;
    }
    i2++;
  }
  return stack.length === 0;
}
var Registry = class _Registry {
  version;
  blocks;
  constructor(blocks, version) {
    this.version = version;
    this.blocks = {};
    for (const [name, info] of Object.entries(blocks)) {
      const props = {};
      for (const [p, vals] of Object.entries(info?.properties ?? {})) props[p] = vals.map(String);
      this.blocks[name] = props;
    }
  }
  /** Build from raw minecraft-data (either accepted shape). */
  static fromData(raw, version) {
    try {
      return new _Registry(normalizeBlockData(raw), version);
    } catch (e) {
      throw new RegistryError(
        `registry data for ${version} has an unexpected shape: ${e.message}`
      );
    }
  }
  /** All known block names (namespaced), sorted. */
  names() {
    return Object.keys(this.blocks).sort(compareCodePoints);
  }
  suggestName(name, n2 = 3) {
    return suggest(name, this.names()).slice(0, n2);
  }
  static allowlistName(entry) {
    try {
      return splitBlock(entry).name;
    } catch {
      return pyStrip(entry);
    }
  }
  /**
   * Validate a palette of canonical block strings. Unknown names are errors
   * with suggestions, illegal properties or values are errors listing what is
   * legal, allowlisted custom names pass with a warning, NBT is only checked
   * for balance, and `minecraft:air` is always legal.
   */
  validate(palette, allowlist = []) {
    const errors = [];
    const warnings = [];
    const allowed = new Set(allowlist.map(_Registry.allowlistName));
    for (const block of palette) {
      let parsed;
      try {
        parsed = splitBlock(block);
      } catch (e) {
        if (!(e instanceof BlockSyntaxError)) throw e;
        errors.push({ block, message: e.message, suggestions: [] });
        continue;
      }
      const { name, props, nbt } = parsed;
      if (name === AIR5) continue;
      if (nbt !== null && !nbtBalanced(nbt)) {
        errors.push({
          block,
          message: `unbalanced braces/brackets in block-entity NBT of ${pyRepr(block)}`,
          suggestions: []
        });
        continue;
      }
      const info = Object.hasOwn(this.blocks, name) ? this.blocks[name] : void 0;
      if (info === void 0) {
        if (allowed.has(name)) {
          warnings.push({
            block,
            message: `${name} is allowlisted: unvalidated, build at own risk`
          });
        } else if (name.includes(":") && !name.startsWith("minecraft:")) {
          errors.push({
            block,
            message: `unknown block ${pyRepr(name)} (not in the ${this.version} registry); add it to \`allowlist\` in mcbuild.toml if it is a modded/custom block`,
            suggestions: []
          });
        } else {
          errors.push({
            block,
            message: `unknown block ${pyRepr(name)} (not in the ${this.version} registry)`,
            suggestions: this.suggestName(name)
          });
        }
        continue;
      }
      for (const [prop, value] of props) {
        const legal = Object.hasOwn(info, prop) ? info[prop] : void 0;
        if (legal === void 0) {
          errors.push({
            block,
            message: `unknown property ${pyRepr(prop)} on ${name}; legal properties: ${pyReprList(Object.keys(info).sort(compareCodePoints))}`,
            suggestions: getCloseMatches(prop, Object.keys(info), 3, 0.6)
          });
          continue;
        }
        if (!legal.includes(value)) {
          const lower = value.toLowerCase();
          const hint = legal.some((v) => v.toLowerCase() === lower) ? ` (did you mean ${pyRepr(lower)}? values are case-sensitive)` : "";
          errors.push({
            block,
            message: `illegal value ${pyRepr(value)} for property ${pyRepr(prop)} on ${name}${hint}; legal values: ${pyReprList(legal)}`,
            suggestions: []
          });
        }
      }
    }
    return { errors, warnings };
  }
};

// packages/mcbuilder/src/report.ts
function viewEntry(options) {
  return {
    file: options.file,
    azimuth: options.view.azimuth,
    elevation: options.view.elevation,
    label: options.view.label,
    directions_untrusted: options.directionsUntrusted ?? true,
    directions_trusted: options.directionsTrusted ?? false
  };
}
function buildReport(input) {
  return {
    errors: input.errors.map((e) => ({ ...e })),
    warnings: input.warnings.map((w) => ({ ...w })),
    block_counts: { ...input.blockCounts },
    dimensions: input.dimensions ? { x: input.dimensions[0], y: input.dimensions[1], z: input.dimensions[2] } : null,
    origin: input.origin ? input.origin.map((v) => Math.trunc(v)) : null,
    views: input.views.map((v) => ({ ...v })),
    artifacts: input.artifacts ? input.artifacts.map((a) => ({ ...a })) : [],
    overwritten_placements: input.overwrittenPlacements ?? 0,
    run_dir: input.runDir
  };
}
function reportToJson(report) {
  const text2 = JSON.stringify(report, null, 2);
  return `${text2.replace(/[\u0080-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)}
`;
}

// packages/mcbuilder/src/node/assets.ts
import { createHash } from "node:crypto";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join as join3, resolve, sep } from "node:path";

// node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/index.mjs
import { createRequire } from "module";
var require2 = createRequire("/");
var _a;
var Worker;
var isMarkedAsUntransferable;
try {
  _a = require2("worker_threads"), Worker = _a.Worker, isMarkedAsUntransferable = _a.isMarkedAsUntransferable;
} catch (e) {
}
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]);
var fdeb = new u8([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = function(eb, start) {
  var b = new u16(31);
  for (var i2 = 0; i2 < 31; ++i2) {
    b[i2] = start += 1 << eb[i2 - 1];
  }
  var r = new i32(b[30]);
  for (var i2 = 1; i2 < 30; ++i2) {
    for (var j = b[i2]; j < b[i2 + 1]; ++j) {
      r[j] = j - b[i2] << 5 | i2;
    }
  }
  return { b, r };
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0; i < 32768; ++i) {
  x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var x;
var i;
var hMap = (function(cd, mb, r) {
  var s = cd.length;
  var i2 = 0;
  var l = new u16(mb);
  for (; i2 < s; ++i2) {
    if (cd[i2])
      ++l[cd[i2] - 1];
  }
  var le = new u16(mb);
  for (i2 = 1; i2 < mb; ++i2) {
    le[i2] = le[i2 - 1] + l[i2 - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        var sv = i2 << 4 | cd[i2];
        var r_1 = mb - cd[i2];
        var v = le[cd[i2] - 1]++ << r_1;
        for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
          co[rev[v] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        co[i2] = rev[le[cd[i2] - 1]++] >> 15 - cd[i2];
      }
    }
  }
  return co;
});
var flt = new u8(288);
for (i = 0; i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144; i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256; i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280; i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0; i < 32; ++i)
  fdt[i] = 5;
var i;
var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
var max = function(a) {
  var m = a[0];
  for (var i2 = 1; i2 < a.length; ++i2) {
    if (a[i2] > m)
      m = a[i2];
  }
  return m;
};
var bits = function(d, p, m) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
};
var bits16 = function(d, p) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
};
var shft = function(p) {
  return (p + 7) / 8 | 0;
};
var slc = function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  return new u8(v.subarray(s, e));
};
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  // determined by compression function
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
];
var err = function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
};
var inflt = function(dat, st, buf, dict) {
  var sl = dat.length, dl = dict ? dict.length : 0;
  if (!sl || st.f && !st.l)
    return buf || new u8(0);
  var noBuf = !buf;
  var resize = noBuf || st.i != 2;
  var noSt = st.i;
  if (noBuf)
    buf = new u8(sl * 3);
  var cbuf = function(l2) {
    var bl = buf.length;
    if (l2 > bl) {
      var nbuf = new u8(Math.max(bl * 2, l2));
      nbuf.set(buf);
      buf = nbuf;
    }
  };
  var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
  var tbts = sl * 8;
  do {
    if (!lm) {
      final = bits(dat, pos, 1);
      var type = bits(dat, pos + 1, 3);
      pos += 3;
      if (!type) {
        var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
        if (t > sl) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + l);
        buf.set(dat.subarray(s, t), bt);
        st.b = bt += l, st.p = pos = t * 8, st.f = final;
        continue;
      } else if (type == 1)
        lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
      else if (type == 2) {
        var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
        var tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        var ldt = new u8(tl);
        var clt = new u8(19);
        for (var i2 = 0; i2 < hcLen; ++i2) {
          clt[clim[i2]] = bits(dat, pos + i2 * 3, 7);
        }
        pos += hcLen * 3;
        var clb = max(clt), clbmsk = (1 << clb) - 1;
        var clm = hMap(clt, clb, 1);
        for (var i2 = 0; i2 < tl; ) {
          var r = clm[bits(dat, pos, clbmsk)];
          pos += r & 15;
          var s = r >> 4;
          if (s < 16) {
            ldt[i2++] = s;
          } else {
            var c = 0, n2 = 0;
            if (s == 16)
              n2 = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i2 - 1];
            else if (s == 17)
              n2 = 3 + bits(dat, pos, 7), pos += 3;
            else if (s == 18)
              n2 = 11 + bits(dat, pos, 127), pos += 7;
            while (n2--)
              ldt[i2++] = c;
          }
        }
        var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
        lbt = max(lt);
        dbt = max(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else
        err(1);
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
    }
    if (resize)
      cbuf(bt + 131072);
    var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
    var lpos = pos;
    for (; ; lpos = pos) {
      var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
      pos += c & 15;
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
      if (!c)
        err(2);
      if (sym < 256)
        buf[bt++] = sym;
      else if (sym == 256) {
        lpos = pos, lm = null;
        break;
      } else {
        var add = sym - 254;
        if (sym > 264) {
          var i2 = sym - 257, b = fleb[i2];
          add = bits(dat, pos, (1 << b) - 1) + fl[i2];
          pos += b;
        }
        var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
        if (!d)
          err(3);
        pos += d & 15;
        var dt = fd[dsym];
        if (dsym > 3) {
          var b = fdeb[dsym];
          dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
        }
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + 131072);
        var end = bt + add;
        if (bt < dt) {
          var shift = dl - dt, dend = Math.min(dt, end);
          if (shift + bt < 0)
            err(3);
          for (; bt < dend; ++bt)
            buf[bt] = dict[shift + bt];
        }
        for (; bt < end; ++bt)
          buf[bt] = buf[bt - dt];
      }
    }
    st.l = lm, st.p = lpos, st.b = bt, st.f = final;
    if (lm)
      final = 1, st.m = lbt, st.d = dm, st.n = dbt;
  } while (!final);
  return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
var et = /* @__PURE__ */ new u8(0);
var b2 = function(d, b) {
  return d[b] | d[b + 1] << 8;
};
var b4 = function(d, b) {
  return (d[b] | d[b + 1] << 8 | d[b + 2] << 16 | d[b + 3] << 24) >>> 0;
};
var b8 = function(d, b) {
  return b4(d, b) + b4(d, b + 4) * 4294967296;
};
function inflateSync(data, opts) {
  return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}
var dutf8 = function(d) {
  for (var r = "", i2 = 0; ; ) {
    var c = d[i2++];
    var eb = (c > 127) + (c > 223) + (c > 239);
    if (i2 + eb > d.length)
      return { s: r, r: slc(d, i2 - 1) };
    if (!eb)
      r += String.fromCharCode(c);
    else if (eb == 3) {
      c = ((c & 15) << 18 | (d[i2++] & 63) << 12 | (d[i2++] & 63) << 6 | d[i2++] & 63) - 65536, r += String.fromCharCode(55296 | c >> 10, 56320 | c & 1023);
    } else if (eb & 1)
      r += String.fromCharCode((c & 31) << 6 | d[i2++] & 63);
    else
      r += String.fromCharCode((c & 15) << 12 | (d[i2++] & 63) << 6 | d[i2++] & 63);
  }
};
function strFromU8(dat, latin1) {
  if (latin1) {
    var r = "";
    for (var i2 = 0; i2 < dat.length; i2 += 16384)
      r += String.fromCharCode.apply(null, dat.subarray(i2, i2 + 16384));
    return r;
  } else if (td) {
    return td.decode(dat);
  } else {
    var _a2 = dutf8(dat), s = _a2.s, r = _a2.r;
    if (r.length)
      err(8);
    return s;
  }
}
var slzh = function(d, b) {
  return b + 30 + b2(d, b + 26) + b2(d, b + 28);
};
var zh = function(d, b, z) {
  var fnl = b2(d, b + 28), efl = b2(d, b + 30), fn = strFromU8(d.subarray(b + 46, b + 46 + fnl), !(b2(d, b + 8) & 2048)), es = b + 46 + fnl;
  var _a2 = z64hs(d, es, efl, z, b4(d, b + 20), b4(d, b + 24), b4(d, b + 42)), sc = _a2[0], su = _a2[1], off = _a2[2];
  return [b2(d, b + 10), sc, su, fn, es + efl + b2(d, b + 32), off];
};
var z64hs = function(d, b, l, z, sc, su, off) {
  var nsc = sc == 4294967295, nsu = su == 4294967295, noff = off == 4294967295, e = b + l;
  var nf = nsc + nsu + noff;
  if (z && nf) {
    for (; b + 4 < e; b += 4 + b2(d, b + 2)) {
      if (b2(d, b) == 1) {
        return [
          nsc ? b8(d, b + 4 + 8 * nsu) : sc,
          nsu ? b8(d, b + 4) : su,
          noff ? b8(d, b + 4 + 8 * (nsu + nsc)) : off,
          1
        ];
      }
    }
    if (z < 2)
      err(13);
  }
  return [sc, su, off, 0];
};
function unzipSync(data, opts) {
  var files = {};
  var e = data.length - 22;
  for (; b4(data, e) != 101010256; --e) {
    if (!e || data.length - e > 65558)
      err(13);
  }
  ;
  var c = b2(data, e + 8);
  if (!c)
    return {};
  var o = b4(data, e + 16);
  var z = b4(data, e - 20) == 117853008;
  if (z) {
    var ze = b4(data, e - 12);
    z = b4(data, ze) == 101075792;
    if (z) {
      c = b4(data, ze + 32);
      o = b4(data, ze + 48);
    }
  }
  var fltr = opts && opts.filter;
  for (var i2 = 0; i2 < c; ++i2) {
    var _a2 = zh(data, o, z), c_2 = _a2[0], sc = _a2[1], su = _a2[2], fn = _a2[3], no = _a2[4], off = _a2[5], b = slzh(data, off);
    o = no;
    if (!fltr || fltr({
      name: fn,
      size: sc,
      originalSize: su,
      compression: c_2
    })) {
      if (!c_2)
        files[fn] = slc(data, b, b + sc);
      else if (c_2 == 8)
        files[fn] = inflateSync(data.subarray(b, b + sc), { out: new u8(su) });
      else
        err(14, "unknown compression type " + c_2);
    }
  }
  return files;
}

// packages/mcbuilder/src/node/assets.ts
var AssetError = class extends McbuilderError {
};
var MC_DATA_RAW = "https://raw.githubusercontent.com/PrismarineJS/minecraft-data/master";
var PISTON_MANIFEST = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
var MCASSET_RAW = "https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets";
var ASSET_SOURCES = ["mcasset", "mojang"];
var CLIENT_PREFIXES = [
  "assets/minecraft/textures/block/",
  "assets/minecraft/models/block/",
  "assets/minecraft/blockstates/",
  "assets/minecraft/textures/entity/"
];
var defaultHttpGet = async (url) => {
  try {
    const res = await fetch(url, { headers: { "user-agent": "voxwright-mcbuilder" } });
    return { status: res.status, body: new Uint8Array(await res.arrayBuffer()) };
  } catch (e) {
    throw new AssetError(
      `network request failed for ${url}: ${e instanceof Error ? e.message : String(e)}`
    );
  }
};
var text = (b) => new TextDecoder().decode(b);
function parseJson(b, what) {
  try {
    return JSON.parse(text(b));
  } catch (e) {
    throw new AssetError(`could not parse ${what}: ${e.message}`);
  }
}
var exists = (p) => stat(p).then(
  () => true,
  () => false
);
async function clientCacheComplete(clientDir) {
  for (const prefix of CLIENT_PREFIXES) {
    const d = join3(clientDir, prefix);
    const entries2 = await readdir(d).catch(() => []);
    if (entries2.length === 0) return false;
  }
  return true;
}
function versionKey(version) {
  const dash = version.indexOf("-");
  const base = dash === -1 ? version : version.slice(0, dash);
  const suffix = dash === -1 ? "" : version.slice(dash + 1);
  const nums = base.split(".").map((p) => /^\d+$/.test(p) ? Number(p) : Number.NaN);
  if (nums.length === 0 || nums.some(Number.isNaN))
    throw new AssetError(`cannot parse MC version '${version}'`);
  return [nums, suffix ? 0 : 1];
}
function compareKeys(a, b) {
  const n2 = Math.min(a[0].length, b[0].length);
  for (let i2 = 0; i2 < n2; i2++) {
    if (a[0][i2] !== b[0][i2]) return a[0][i2] < b[0][i2] ? -1 : 1;
  }
  if (a[0].length !== b[0].length) return a[0].length < b[0].length ? -1 : 1;
  return a[1] - b[1];
}
function closestPcLayout(version, dataPaths) {
  const pc = dataPaths.pc ?? {};
  const want = versionKey(version);
  let best = null;
  for (const key2 of Object.keys(pc)) {
    let k;
    try {
      k = versionKey(key2);
    } catch {
      continue;
    }
    if (compareKeys(k, want) <= 0 && (best === null || compareKeys(versionKey(best), k) < 0))
      best = key2;
  }
  return best === null ? null : pc[best].blocks;
}
async function fallbackLayout(version, get) {
  const { status, body } = await get(`${MC_DATA_RAW}/data/dataPaths.json`);
  if (status !== 200) {
    throw new AssetError(
      `minecraft-data has no data/pc/${version}/blocks.json (HTTP 404) and dataPaths.json could not be fetched (HTTP ${status}); check the version string or your network connection.`
    );
  }
  const dataPaths = parseJson(
    body,
    "minecraft-data dataPaths.json"
  );
  const layout = closestPcLayout(version, dataPaths);
  if (layout === null) {
    let newest = null;
    for (const key2 of Object.keys(dataPaths.pc ?? {})) {
      try {
        if (newest === null || compareKeys(versionKey(newest), versionKey(key2)) < 0) newest = key2;
      } catch {
      }
    }
    throw new AssetError(
      `version '${version}' is not in PrismarineJS/minecraft-data yet (newest pc layout available: ${newest}); minecraft-data lags new releases: either wait for it to update or fetch with an older \`--version\` and accept the older registry.`
    );
  }
  return layout;
}
async function downloadRegistry(version, dest, force, get) {
  const target = join3(dest, "minecraft-data.json");
  if (!force && await exists(target)) return;
  let layout = `pc/${version}`;
  let res = await get(`${MC_DATA_RAW}/data/${layout}/blocks.json`);
  if (res.status === 404) {
    layout = await fallbackLayout(version, get);
    res = await get(`${MC_DATA_RAW}/data/${layout}/blocks.json`);
  }
  if (res.status !== 200) {
    throw new AssetError(
      `could not download the block registry for '${version}' (HTTP ${res.status}); check the version string or your network connection.`
    );
  }
  const raw = parseJson(res.body, `the registry payload for '${version}'`);
  let blocks;
  try {
    blocks = normalizeBlockData(raw);
  } catch (e) {
    throw new AssetError(
      `registry payload for '${version}' had an unexpected shape: ${e.message}`
    );
  }
  await writeFile(target, JSON.stringify({ version, layout, blocks }), "utf8");
}
async function safeWrite(root, name, data) {
  const resolvedRoot = resolve(root);
  const target = resolve(root, name);
  if (target !== resolvedRoot && !target.startsWith(resolvedRoot + sep)) {
    throw new AssetError(`refusing to extract suspicious zip entry '${name}'`);
  }
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, data);
}
async function fetchClient(version, dest, force, get) {
  const clientDir = join3(dest, "client");
  if (!force && await clientCacheComplete(clientDir)) return;
  let res = await get(PISTON_MANIFEST);
  if (res.status !== 200) {
    throw new AssetError(
      `could not reach the Mojang Piston version manifest (HTTP ${res.status}); check your network connection.`
    );
  }
  const manifest = parseJson(
    res.body,
    "the Piston version manifest"
  );
  const entry = (manifest.versions ?? []).find((v) => v.id === version);
  if (entry === void 0) {
    throw new AssetError(
      `version '${version}' not found in Mojang's version manifest: check the version string (Piston uses plain release ids like '26.2' or '1.21.4').`
    );
  }
  res = await get(entry.url);
  if (res.status !== 200) {
    throw new AssetError(
      `could not fetch the Piston version metadata for '${version}' (HTTP ${res.status}).`
    );
  }
  let jarUrl;
  let sha1;
  try {
    const client = JSON.parse(text(res.body)).downloads.client;
    jarUrl = client.url;
    sha1 = client.sha1;
    if (typeof jarUrl !== "string" || typeof sha1 !== "string")
      throw new Error("missing url or sha1");
  } catch (e) {
    throw new AssetError(
      `Piston metadata for '${version}' has no usable downloads.client entry: ${e.message}`
    );
  }
  const jar = await get(jarUrl);
  if (jar.status !== 200)
    throw new AssetError(
      `could not download the client jar for '${version}' (HTTP ${jar.status}).`
    );
  if (createHash("sha1").update(jar.body).digest("hex") !== sha1.toLowerCase()) {
    throw new AssetError(
      `client jar for '${version}' failed sha1 verification: the download may be corrupt; delete the cache dir and retry.`
    );
  }
  let files;
  try {
    files = unzipSync(jar.body, {
      filter: (f) => f.name === "version.json" || CLIENT_PREFIXES.some((p) => f.name.startsWith(p)) && !f.name.endsWith("/")
    });
  } catch (e) {
    throw new AssetError(
      `downloaded client jar for '${version}' is not a valid zip: ${e.message}`
    );
  }
  const members = Object.keys(files).filter((n2) => n2 !== "version.json");
  if (members.length === 0) {
    throw new AssetError(
      `client jar for '${version}' contained none of the expected asset paths (textures/block, models/block, blockstates).`
    );
  }
  for (const name of members) await safeWrite(clientDir, name, files[name]);
  if (files["version.json"]) await safeWrite(dest, "version.json", files["version.json"]);
}
async function getTwice(get, url) {
  try {
    const res = await get(url);
    if (res.status < 500 && res.status !== 429) return res;
  } catch {
  }
  await new Promise((r) => setTimeout(r, 500));
  return get(url);
}
async function pool(items, limit, job) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await job(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
var MCASSET_PARALLEL = 24;
async function fetchClientFromMcasset(version, dest, force, get) {
  const clientDir = join3(dest, "client");
  if (!force && await clientCacheComplete(clientDir)) return;
  const base = `${MCASSET_RAW}/${encodeURIComponent(version)}/assets/minecraft`;
  const files = /* @__PURE__ */ new Map();
  for (const sub of ["blockstates", "models/block"]) {
    const res = await getTwice(get, `${base}/${sub}/_all.json`);
    if (res.status === 404) {
      throw new AssetError(
        `version '${version}' is not in InventivetalentDev/minecraft-assets (no ${sub}/_all.json on a branch of that name): check the version string, or fetch from Mojang with \`--from mojang\`.`
      );
    }
    if (res.status !== 200) {
      throw new AssetError(
        `could not download ${sub} for '${version}' from minecraft-assets (HTTP ${res.status}).`
      );
    }
    const all = parseJson(res.body, `${sub}/_all.json for '${version}'`);
    if (all === null || typeof all !== "object" || Array.isArray(all)) {
      throw new AssetError(`${sub}/_all.json for '${version}' had an unexpected shape`);
    }
    for (const [name, value] of Object.entries(all)) {
      files.set(`${sub}/${name}.json`, new TextEncoder().encode(JSON.stringify(value)));
    }
  }
  const textures = [];
  let dirs = ["textures/block", "textures/entity"];
  while (dirs.length > 0) {
    const found = [];
    await pool(dirs, MCASSET_PARALLEL, async (dir) => {
      const res = await getTwice(get, `${base}/${dir}/_list.json`);
      if (res.status !== 200) {
        throw new AssetError(
          `could not list ${dir} for '${version}' in minecraft-assets (HTTP ${res.status}).`
        );
      }
      const list2 = parseJson(
        res.body,
        `${dir}/_list.json for '${version}'`
      );
      for (const d of Array.isArray(list2.directories) ? list2.directories : []) {
        if (typeof d === "string") found.push(`${dir}/${d}`);
      }
      for (const f of Array.isArray(list2.files) ? list2.files : []) {
        if (typeof f === "string" && f !== "_list.json" && f !== "_all.json") {
          textures.push(`${dir}/${f}`);
        }
      }
    });
    dirs = found;
  }
  await pool(textures, MCASSET_PARALLEL, async (path) => {
    const res = await getTwice(get, `${base}/${path.split("/").map(encodeURIComponent).join("/")}`);
    if (res.status !== 200) {
      throw new AssetError(
        `could not download ${path} for '${version}' from minecraft-assets (HTTP ${res.status}).`
      );
    }
    files.set(path, res.body);
  });
  for (const [path, data] of files) {
    await safeWrite(clientDir, `assets/minecraft/${path}`, data);
  }
}
async function fetchClientAssets(version, cacheDir, options = {}) {
  const dest = join3(cacheDir, version);
  await mkdir(dest, { recursive: true });
  const get = options.get ?? defaultHttpGet;
  if ((options.source ?? "mcasset") === "mojang") {
    await fetchClient(version, dest, options.force ?? false, get);
  } else {
    await fetchClientFromMcasset(version, dest, options.force ?? false, get);
  }
  return join3(dest, "client");
}
async function fetchAssets(version, cacheDir, options = {}) {
  const dest = join3(cacheDir, version);
  await mkdir(dest, { recursive: true });
  const get = options.get ?? defaultHttpGet;
  await downloadRegistry(version, dest, options.force ?? false, get);
  await fetchClientAssets(version, cacheDir, options);
  return dest;
}
async function fetchRegistry(version, cacheDir, options = {}) {
  const dest = join3(cacheDir, version);
  await mkdir(dest, { recursive: true });
  await downloadRegistry(version, dest, options.force ?? false, options.get ?? defaultHttpGet);
  return join3(dest, "minecraft-data.json");
}

// packages/mcbuilder/src/node/diff.ts
import { readdir as readdir2, readFile, stat as stat2 } from "node:fs/promises";
import { join as join4 } from "node:path";
var isDir = async (p) => (await stat2(p).catch(() => null))?.isDirectory() ?? false;
var isFile = async (p) => (await stat2(p).catch(() => null))?.isFile() ?? false;
async function resolveRunDir(runsDir, runId) {
  const raw = pyStrip(String(runId));
  if (raw === "" || raw.includes("/") || raw.startsWith("."))
    throw new DiffError(`invalid run id: '${runId}'`);
  const candidates = [raw];
  if (!raw.startsWith("run-")) {
    candidates.push(`run-${raw}`);
    if (/^\d+$/.test(raw)) candidates.push(`run-${String(Number(raw)).padStart(3, "0")}`);
  }
  for (const name of candidates) {
    if (await isDir(join4(runsDir, name))) return join4(runsDir, name);
  }
  throw new DiffError(`unknown run: ${raw} (no such directory in ${runsDir})`);
}
async function artifactNbtPath(runDir, report) {
  for (const art of report.artifacts ?? []) {
    if (art.format === "nbt" && art.file) return join4(runDir, art.file);
  }
  const candidates = (await readdir2(runDir)).filter((f) => f.endsWith(".nbt")).sort();
  const name = runDir.split("/").pop();
  if (candidates.length === 1) return join4(runDir, candidates[0]);
  if (candidates.length === 0) {
    throw new DiffError(
      `${name}: no .nbt artifact (runs with validation errors export none — diff needs two clean runs)`
    );
  }
  throw new DiffError(`${name}: several .nbt files and report.json names none — cannot pick one`);
}
async function loadRunVoxels(runDir) {
  const name = runDir.split("/").pop();
  if (!await isDir(runDir)) throw new DiffError(`not a run directory: ${runDir}`);
  const reportPath = join4(runDir, "report.json");
  if (!await isFile(reportPath))
    throw new DiffError(`${runDir} has no report.json — not an mcbuild run dir`);
  let report;
  try {
    report = JSON.parse(await readFile(reportPath, "utf8"));
  } catch (e) {
    throw new DiffError(`${name}: cannot parse report.json: ${e.message}`);
  }
  const nbtPath = await artifactNbtPath(runDir, report);
  const nbtName = nbtPath.split("/").pop();
  if (!await isFile(nbtPath)) throw new DiffError(`${name}: artifact not found: ${nbtName}`);
  let root;
  try {
    root = await readNbtFile(new Uint8Array(await readFile(nbtPath)));
  } catch (e) {
    throw new DiffError(`${name}: cannot read ${nbtName}: ${e.message}`);
  }
  const origin = report.origin ?? [0, 0, 0];
  const [ox, oy, oz] = origin.map(
    (v) => typeof v === "number" && Number.isInteger(v) ? v : Number.NaN
  );
  if ([ox, oy, oz].some((v) => v === void 0 || Number.isNaN(v)) || origin.length !== 3) {
    throw new DiffError(`${name}: report.json has a malformed origin: ${JSON.stringify(origin)}`);
  }
  try {
    const paletteTag = root.tag.value.get("palette");
    const blocksTag = root.tag.value.get("blocks");
    if (paletteTag?.type !== "list" || blocksTag?.type !== "list")
      throw new Error("no palette or blocks");
    const palette = paletteTag.value.map((entry) => {
      if (entry.type !== "compound") throw new Error("bad palette entry");
      const nameTag = entry.value.get("Name") ?? entry.value.get("id");
      if (nameTag?.type !== "string") throw new Error("palette entry without Name");
      const propsTag = entry.value.get("Properties") ?? entry.value.get("properties");
      const props = [];
      if (propsTag?.type === "compound")
        for (const [k, v] of propsTag.value) props.push([k, String(v.value)]);
      props.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
      return canonicalize(
        props.length > 0 ? `${nameTag.value}[${props.map(([k, v]) => `${k}=${v}`).join(",")}]` : nameTag.value
      );
    });
    const cells = /* @__PURE__ */ new Map();
    for (const b of blocksTag.value) {
      if (b.type !== "compound") throw new Error("bad block");
      const pos = b.value.get("pos");
      const state = b.value.get("state");
      if (pos?.type !== "list" || pos.value.length !== 3 || state === void 0 || state.type !== "int") {
        throw new Error("bad block entry");
      }
      const [px, py, pz] = pos.value.map((v) => v.value);
      const block = palette[state.value];
      if (block === void 0) throw new Error("state index outside the palette");
      if (parse(block).name === "minecraft:air") continue;
      cells.set(voxelKey(px + ox, py + oy, pz + oz), block);
    }
    return cells;
  } catch (e) {
    throw new DiffError(`${name}: malformed ${nbtName}: ${e.message}`);
  }
}
async function diffRunDirs(aDir, bDir) {
  return diffVoxelMaps(await loadRunVoxels(aDir), await loadRunVoxels(bDir));
}

// packages/mcbuilder/src/node/script.ts
import { stat as stat3 } from "node:fs/promises";
import { basename, resolve as resolve2 } from "node:path";
import { pathToFileURL } from "node:url";

// packages/mcbuilder/src/sha256.ts
var K2 = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var rotr = (x2, n2) => x2 >>> n2 | x2 << 32 - n2;
function sha256(data) {
  const bitLen = data.length * 8;
  const padded = new Uint8Array(Math.ceil((data.length + 9) / 64) * 64);
  padded.set(data);
  padded[data.length] = 128;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296));
  view.setUint32(padded.length - 4, bitLen >>> 0);
  const h = new Uint32Array([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ]);
  const w = new Uint32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i2 = 0; i2 < 16; i2++) w[i2] = view.getUint32(off + i2 * 4);
    for (let i2 = 16; i2 < 64; i2++) {
      const w15 = w[i2 - 15];
      const w2 = w[i2 - 2];
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ w15 >>> 3;
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ w2 >>> 10;
      w[i2] = w[i2 - 16] + s0 + w[i2 - 7] + s1 | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i2 = 0; i2 < 64; i2++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = e & f ^ ~e & g;
      const t1 = hh + S1 + ch + K2[i2] + w[i2] | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = a & b ^ a & c ^ b & c;
      const t2 = S0 + maj | 0;
      hh = g;
      g = f;
      f = e;
      e = d + t1 | 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 | 0;
    }
    h[0] = h[0] + a | 0;
    h[1] = h[1] + b | 0;
    h[2] = h[2] + c | 0;
    h[3] = h[3] + d | 0;
    h[4] = h[4] + e | 0;
    h[5] = h[5] + f | 0;
    h[6] = h[6] + g | 0;
    h[7] = h[7] + hh | 0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let i2 = 0; i2 < 8; i2++) ov.setUint32(i2 * 4, h[i2]);
  return out;
}

// packages/mcbuilder/src/materials.ts
function pyStr(v) {
  if (v === null || v === void 0) return "None";
  return String(v);
}
function entries(spec) {
  if (!Array.isArray(spec)) {
    throw new McbuilderError(
      `invalid material spec ${JSON.stringify(spec)}: expected a block string, a sequence of block strings / (block, weight) pairs, or a callable (x, y, z) -> str`
    );
  }
  const out = [];
  for (const e of spec) {
    if (typeof e === "string") {
      out.push([canonicalize(e), 1]);
    } else if (Array.isArray(e) && e.length === 2 && typeof e[0] === "string") {
      const w = e[1];
      if (typeof w !== "number" || Number.isNaN(w)) {
        throw new McbuilderError(`invalid palette weight ${String(w)} for '${e[0]}'`);
      }
      if (w < 0) throw new McbuilderError(`negative palette weight ${w} for '${e[0]}'`);
      out.push([canonicalize(e[0]), w]);
    } else {
      throw new McbuilderError(
        `invalid palette entry ${JSON.stringify(e)}: expected a block string or a (block, weight) pair`
      );
    }
  }
  if (out.length === 0) throw new McbuilderError("material palette is empty");
  if (sum(out) <= 0) throw new McbuilderError("material palette weights sum to zero");
  return out;
}
var sum = (es) => es.reduce((acc, [, w]) => acc + w, 0);
function unitHash(...key2) {
  const bytes = sha256(new TextEncoder().encode(key2.map(pyStr).join("\0")));
  let n2 = 0n;
  for (let i2 = 0; i2 < 8; i2++) n2 = n2 << 8n | BigInt(bytes[i2]);
  return Number(n2) / 2 ** 64;
}
function pick(es, r) {
  const target = r * sum(es);
  let acc = 0;
  for (const [block, w] of es) {
    acc += w;
    if (target < acc) return block;
  }
  return es[es.length - 1][0];
}
function resolveMaterial(spec, x2, y, z, seed) {
  if (typeof spec === "string") return canonicalize(spec);
  if (typeof spec === "function") return canonicalize(spec(x2, y, z));
  return pick(entries(spec), unitHash(seed, x2, y, z));
}
function patches(palette, options = {}) {
  const scale = options.scale ?? 4;
  const salt = options.salt ?? "";
  const es = entries(palette);
  if (!(scale > 0)) throw new McbuilderError(`patches: scale must be > 0, got ${scale}`);
  const lattice = (ix, iy, iz) => unitHash("patches", salt, ix, iy, iz);
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise = (x2, y, z) => {
    const fx = x2 / scale;
    const fy = y / scale;
    const fz = z / scale;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const iz = Math.floor(fz);
    const tx = smooth(fx - ix);
    const ty = smooth(fy - iy);
    const tz = smooth(fz - iz);
    let v = 0;
    for (const [dx, wx] of [
      [0, 1 - tx],
      [1, tx]
    ]) {
      for (const [dy, wy] of [
        [0, 1 - ty],
        [1, ty]
      ]) {
        for (const [dz, wz] of [
          [0, 1 - tz],
          [1, tz]
        ]) {
          v += wx * wy * wz * lattice(ix + dx, iy + dy, iz + dz);
        }
      }
    }
    return v;
  };
  const equalize = (value) => {
    const v = Math.min(1, Math.max(0, (value - 0.5) * 1.7 + 0.5));
    return Math.min(0.999999, smooth(v));
  };
  return (x2, y, z) => pick(es, equalize(noise(x2, y, z)));
}

// packages/mcbuilder/src/geometry.ts
function checkInts(what, ...values) {
  for (const v of values) {
    if (typeof v !== "number" || !Number.isInteger(v)) {
      throw new TypeError(`${what} must be ints, got ${String(v)}`);
    }
  }
}
var Geometry = class _Geometry {
  cellList = [];
  /** Add one block (any material spec) at `(dx, dy, dz)`. */
  set(dx, dy, dz, block) {
    checkInts("geometry coordinates", dx, dy, dz);
    this.cellList.push([dx, dy, dz, resolveMaterial(block, dx, dy, dz)]);
  }
  /** Combine two geometries; later cells win on overlap when stamped. */
  concat(other) {
    const out = new _Geometry();
    out.cellList = [...this.cellList, ...other.cellList];
    return out;
  }
  /** Translate every cell. Block states are untouched. */
  shift(dx, dy, dz) {
    checkInts("shift offsets", dx, dy, dz);
    const out = new _Geometry();
    out.cellList = this.cellList.map(([x2, y, z, b]) => [x2 + dx, y + dy, z + dz, b]);
    return out;
  }
  /**
   * Rotate every cell about `anchor`, clockwise viewed from above. Block
   * states rotate too, so a rotated stair assembly keeps pointing the right way.
   */
  rotate(rotation = "CLOCKWISE_90", anchor = [0, 0, 0]) {
    const [ax, , az] = anchor;
    checkInts("rotate: anchor coordinates", ...anchor);
    const out = new _Geometry();
    for (const [x2, y, z, b] of this.cellList) {
      const [rx, rz] = rotatePoint(x2, z, ax, az, rotation);
      out.cellList.push([rx, y, rz, rotateBlockstate(b, rotation)]);
    }
    return out;
  }
  /** Mirror across the `axis` plane through the origin (`x` maps x to -x, `z` maps z to -z). */
  mirror(axis = "x") {
    if (axis !== "x" && axis !== "z") {
      throw new TypeError(`mirror: axis must be 'x' or 'z', got ${String(axis)}`);
    }
    const out = new _Geometry();
    for (const [x2, y, z, b] of this.cellList) {
      out.cellList.push(
        axis === "x" ? [0 - x2, y, z, mirrorBlockstate(b, axis)] : [x2, y, 0 - z, mirrorBlockstate(b, axis)]
      );
    }
    return out;
  }
  /** Remove every cell in the inclusive relative box `c1`..`c2`. Corners may be in any order. */
  carve(c1, c2) {
    checkInts("carve: corner coordinates", ...c1, ...c2);
    const [lx, hx] = [Math.min(c1[0], c2[0]), Math.max(c1[0], c2[0])];
    const [ly, hy] = [Math.min(c1[1], c2[1]), Math.max(c1[1], c2[1])];
    const [lz, hz] = [Math.min(c1[2], c2[2]), Math.max(c1[2], c2[2])];
    const out = new _Geometry();
    out.cellList = this.cellList.filter(
      ([x2, y, z]) => !(lx <= x2 && x2 <= hx && ly <= y && y <= hy && lz <= z && z <= hz)
    );
    return out;
  }
  /** The relative placements, in the order they were added. */
  cells() {
    return [...this.cellList];
  }
  get length() {
    return this.cellList.length;
  }
  /** Inclusive relative bounding box, or `null` when empty. */
  bounds() {
    if (this.cellList.length === 0) return null;
    let [x0, y0, z0] = this.cellList[0];
    let [x1, y1, z1] = [x0, y0, z0];
    for (const [x2, y, z] of this.cellList) {
      if (x2 < x0) x0 = x2;
      if (y < y0) y0 = y;
      if (z < z0) z0 = z;
      if (x2 > x1) x1 = x2;
      if (y > y1) y1 = y;
      if (z > z1) z1 = z;
    }
    return [
      [x0, y0, z0],
      [x1, y1, z1]
    ];
  }
  /** @internal Used by `Build.place`; cells are already resolved. */
  static fromCells(cells) {
    const g = new _Geometry();
    g.cellList = cells;
    return g;
  }
};

// packages/mcbuilder/src/rng.ts
var Rng = class _Rng {
  a;
  b;
  c;
  d;
  /** Seed from any string. Equal strings give equal sequences. */
  constructor(seed) {
    const h = new DataView(sha256(new TextEncoder().encode(seed)).buffer);
    this.a = h.getUint32(0);
    this.b = h.getUint32(4);
    this.c = h.getUint32(8);
    this.d = h.getUint32(12);
    for (let i2 = 0; i2 < 12; i2++) this.nextUint32();
  }
  /** A generator seeded from the system's entropy source. */
  static unseeded() {
    const words = globalThis.crypto.getRandomValues(new Uint32Array(4));
    return new _Rng(Array.from(words).join(","));
  }
  nextUint32() {
    const t = (this.a + this.b | 0) + this.d | 0;
    this.d = this.d + 1 | 0;
    this.a = this.b ^ this.b >>> 9;
    this.b = this.c + (this.c << 3) | 0;
    this.c = this.c << 21 | this.c >>> 11;
    this.c = this.c + t | 0;
    return t >>> 0;
  }
  /** A float in [0, 1). */
  random() {
    return this.nextUint32() / 4294967296;
  }
  /** A float in [a, b). */
  uniform(a, b) {
    return a + (b - a) * this.random();
  }
  /** An integer in [lo, hi], both inclusive. */
  int(lo, hi) {
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || hi < lo) {
      throw new RangeError(`int: need integers with hi >= lo, got ${lo}, ${hi}`);
    }
    return lo + Math.floor(this.random() * (hi - lo + 1));
  }
  choice(items) {
    if (items.length === 0) throw new RangeError("choice: empty sequence");
    return items[Math.floor(this.random() * items.length)];
  }
  /** Fisher-Yates shuffle, in place. */
  shuffle(items) {
    for (let i2 = items.length - 1; i2 > 0; i2--) {
      const j = Math.floor(this.random() * (i2 + 1));
      [items[i2], items[j]] = [items[j], items[i2]];
    }
    return items;
  }
};

// packages/mcbuilder/src/shapes.ts
var shapes_exports = {};
__export(shapes_exports, {
  DIRECTIONS: () => DIRECTIONS,
  arch: () => arch,
  box: () => box,
  cone: () => cone,
  cylinder: () => cylinder,
  line: () => line,
  parapet: () => parapet,
  pillar: () => pillar,
  railing: () => railing,
  roofGable: () => roofGable,
  roofHip: () => roofHip,
  skirtRoof: () => skirtRoof,
  sphere: () => sphere,
  stairs: () => stairs,
  stairsRun: () => stairsRun,
  walls: () => walls
});
var DIRECTIONS = {
  north: [0, -1],
  south: [0, 1],
  east: [1, 0],
  west: [-1, 0]
};
var isInt = (v) => typeof v === "number" && Number.isInteger(v);
var show = (v) => Array.isArray(v) ? `[${v.join(", ")}]` : String(v);
function point(what, p) {
  if (!Array.isArray(p) || p.length !== 3)
    throw new McbuilderError(`${what} must be 3 ints, got ${show(p)}`);
  if (!p.every(isInt)) throw new McbuilderError(`${what} coordinates must be ints, got ${show(p)}`);
  return p;
}
function corners(what, c1, c2) {
  const [x1, y1, z1] = point(`${what}: c1`, c1);
  const [x2, y2, z2] = point(`${what}: c2`, c2);
  return [
    [Math.min(x1, x2), Math.min(y1, y2), Math.min(z1, z2)],
    [Math.max(x1, x2), Math.max(y1, y2), Math.max(z1, z2)]
  ];
}
function positive(what, v, minimum = 1) {
  if (!isInt(v) || v < minimum)
    throw new McbuilderError(`${what} must be an int >= ${minimum}, got ${show(v)}`);
  return v;
}
function direction(what, d) {
  const key2 = String(d).toLowerCase();
  if (!Object.hasOwn(DIRECTIONS, key2)) {
    throw new McbuilderError(
      `${what}: invalid direction ${d}; expected one of [${Object.keys(DIRECTIONS).sort().join(", ")}]`
    );
  }
  return key2;
}
function withProps(block, extra) {
  const { name, props, nbt } = parse(block);
  const merged = new Map(props);
  for (const [k, v] of Object.entries(extra)) merged.set(k, v);
  return canonicalize(join(name, merged, nbt ?? ""));
}
var Painter = class {
  geo = new Geometry();
  plain;
  block;
  seed;
  constructor(block, seed) {
    this.block = block;
    this.seed = seed;
    this.plain = typeof block === "string" ? canonicalize(block) : null;
  }
  blockAt(x2, y, z) {
    return this.plain || resolveMaterial(this.block, x2, y, z, this.seed);
  }
  put(x2, y, z, extra) {
    const b = this.blockAt(x2, y, z);
    this.geo.set(x2, y, z, extra ? withProps(b, extra) : b);
  }
};
function stairMaterial(what, block, seed) {
  const at = (x2, y, z) => {
    const b = resolveMaterial(block, x2, y, z, seed);
    if (parse(b).props.has("facing")) {
      throw new McbuilderError(
        `${what} computes 'facing' from the geometry; pass the stair block without a facing property`
      );
    }
    return b;
  };
  at(0, 0, 0);
  return at;
}
function box(c1, c2, block, { seed } = {}) {
  const [[x1, y1, z1], [x2, y2, z2]] = corners("box", c1, c2);
  const p = new Painter(block, seed);
  for (let x3 = x1; x3 <= x2; x3++)
    for (let y = y1; y <= y2; y++) for (let z = z1; z <= z2; z++) p.put(x3, y, z);
  return p.geo;
}
function walls(c1, c2, block, { seed } = {}) {
  const [[x1, y1, z1], [x2, y2, z2]] = corners("walls", c1, c2);
  const p = new Painter(block, seed);
  for (let y = y1; y <= y2; y++) {
    for (let x3 = x1; x3 <= x2; x3++) {
      for (let z = z1; z <= z2; z++) {
        if (x3 === x1 || x3 === x2 || z === z1 || z === z2) p.put(x3, y, z);
      }
    }
  }
  return p.geo;
}
function pillar(base, height, block, { seed } = {}) {
  const [x2, y, z] = point("pillar: base", base);
  const h = positive("pillar: height", height);
  return box([x2, y, z], [x2, y + h - 1, z], block, { seed });
}
var roundHalfUp = (v) => Math.floor(v + 0.5);
function line(p1, p2, block, { seed } = {}) {
  const a = point("line: p1", p1);
  const b = point("line: p2", p2);
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const n2 = Math.max(Math.abs(d[0]), Math.abs(d[1]), Math.abs(d[2]));
  const pts = [];
  for (let k = 0; k <= n2; k++) {
    pts.push(
      [0, 1, 2].map(
        (i2) => n2 ? roundHalfUp(a[i2] + d[i2] * k / n2) : a[i2]
      )
    );
  }
  const cells = [pts[0]];
  for (const nxt of pts.slice(1)) {
    const cur = [...cells[cells.length - 1]];
    while (cur[0] !== nxt[0] || cur[1] !== nxt[1] || cur[2] !== nxt[2]) {
      for (let i2 = 0; i2 < 3; i2++) {
        if (cur[i2] !== nxt[i2]) {
          cur[i2] += nxt[i2] > cur[i2] ? 1 : -1;
          break;
        }
      }
      cells.push([cur[0], cur[1], cur[2]]);
    }
  }
  const p = new Painter(block, seed);
  for (const [x2, y, z] of cells) p.put(x2, y, z);
  return p.geo;
}
function stairs(start, dir, block, options = {}) {
  const [sx, sy, sz] = point("stairs: start", start);
  const key2 = direction("stairs", dir);
  const [dx, dz] = DIRECTIONS[key2];
  let length = options.length;
  if (length === void 0 === (options.target === void 0)) {
    throw new McbuilderError("stairs: give exactly one of length or target");
  }
  if (options.target !== void 0) {
    const [tx, ty, tz] = point("stairs: target", options.target);
    const rise = ty - sy;
    const along = dx * (tx - sx) + dz * (tz - sz);
    const across = dz * (tx - sx) - dx * (tz - sz);
    if (rise < 0 || along !== rise || across !== 0) {
      throw new McbuilderError(
        `stairs: target [${options.target.join(", ")}] is not on the 1:1 diagonal from [${start.join(", ")}] climbing ${key2}`
      );
    }
    length = rise + 1;
  }
  const len = positive("stairs: length", length);
  const width = positive("stairs: width", options.width ?? 1);
  const [px, pz] = dx ? [0, 1] : [1, 0];
  const stair = stairMaterial("stairs", block, options.seed);
  const geo = new Geometry();
  for (let i2 = 0; i2 < len; i2++) {
    for (let w = 0; w < width; w++) {
      const x2 = sx + i2 * dx + w * px;
      const y = sy + i2;
      const z = sz + i2 * dz + w * pz;
      geo.set(x2, y, z, withProps(stair(x2, y, z), { facing: key2, half: "bottom" }));
    }
  }
  return geo;
}
function stairsRun(start, dir, block, options = {}) {
  return stairs(start, dir, block, options);
}
function railing(start, end, block, { seed } = {}) {
  const [x1, y1, z1] = point("railing: start", start);
  const [x2, y2, z2] = point("railing: end", end);
  if (y1 !== y2) {
    throw new McbuilderError(
      `railing: start and end must share the same y level (got y=${y1} and y=${y2})`
    );
  }
  if (x1 !== x2 && z1 !== z2) {
    throw new McbuilderError(
      `railing: run must be axis-aligned (x or z constant); got start=${show(start)} end=${show(end)}`
    );
  }
  return line(start, end, block, { seed });
}
function cylinder(center, radius, height, block, options = {}) {
  const [cx, cy, cz] = point("cylinder: center", center);
  const r = positive("cylinder: radius", radius);
  const hgt = positive("cylinder: height", height);
  const axis = options.axis ?? "y";
  if (axis !== "x" && axis !== "y" && axis !== "z") {
    throw new McbuilderError(`cylinder: axis must be 'x', 'y' or 'z', got ${String(axis)}`);
  }
  const shell = new Painter(block, options.seed);
  const inner = options.fill ? new Painter(options.fill, options.seed) : null;
  const r2 = r * r;
  const in2 = (r - 1) ** 2;
  for (let h = 0; h < hgt; h++) {
    for (let a = -r; a <= r; a++) {
      for (let b = -r; b <= r; b++) {
        const d2 = a * a + b * b;
        if (d2 > r2) continue;
        const pos = axis === "y" ? [cx + a, cy + h, cz + b] : axis === "x" ? [cx + h, cy + a, cz + b] : [cx + a, cy + b, cz + h];
        if (options.hollow && d2 <= in2) {
          if (inner) inner.put(...pos);
        } else {
          shell.put(...pos);
        }
      }
    }
  }
  return inner ? inner.geo.concat(shell.geo) : shell.geo;
}
function sphere(center, radius, block, options = {}) {
  const [cx, cy, cz] = point("sphere: center", center);
  const r = positive("sphere: radius", radius);
  const thickness = positive("sphere: thickness", options.thickness ?? 1);
  const shell = new Painter(block, options.seed);
  const inner = options.fill ? new Painter(options.fill, options.seed) : null;
  const r2 = r * r;
  const in2 = Math.max(0, r - thickness) ** 2;
  for (let x2 = cx - r; x2 <= cx + r; x2++) {
    for (let y = options.dome ? cy : cy - r; y <= cy + r; y++) {
      for (let z = cz - r; z <= cz + r; z++) {
        const d2 = (x2 - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2;
        if (d2 > r2) continue;
        if (options.hollow && d2 <= in2) {
          if (inner) inner.put(x2, y, z);
        } else {
          shell.put(x2, y, z);
        }
      }
    }
  }
  return inner ? inner.geo.concat(shell.geo) : shell.geo;
}
function cone(center, radius, height, block, options = {}) {
  const [cx, cy, cz] = point("cone: center", center);
  const rad = positive("cone: radius", radius);
  const hgt = positive("cone: height", height);
  const p = new Painter(block, options.seed);
  for (let i2 = 0; i2 < hgt; i2++) {
    const r = rad * (hgt - i2) / hgt;
    const ri = Math.ceil(r);
    for (let x2 = cx - ri; x2 <= cx + ri; x2++) {
      for (let z = cz - ri; z <= cz + ri; z++) {
        const d2 = (x2 - cx) ** 2 + (z - cz) ** 2;
        if (d2 > r * r) continue;
        const interior = d2 <= Math.max(0, r - 1) ** 2;
        if (options.hollow && interior && !(r < 1 && d2 === 0)) continue;
        p.put(x2, cy + i2, z);
      }
    }
  }
  return p.geo;
}
var halfDefault = (block) => parse(block).props.has("half") ? {} : { half: "bottom" };
function roofGable(c1, c2, block, options) {
  const { ridge, seed } = options;
  if (ridge !== "x" && ridge !== "z") {
    throw new McbuilderError(`roof_gable: ridge must be 'x' or 'z', got ${String(ridge)}`);
  }
  const [[x1, y0, z1], [x2, , z2]] = corners("roof_gable", c1, c2);
  const body = stairMaterial("roof_gable", block, seed);
  const verge = options.verge ? stairMaterial("roof_gable", options.verge, seed) : null;
  const eave = options.eave ? stairMaterial("roof_gable", options.eave, seed) : null;
  const [lo, hi, runLo, runHi, faceLo, faceHi] = ridge === "x" ? [z1, z2, x1, x2, "south", "north"] : [x1, x2, z1, z2, "east", "west"];
  const span = hi - lo + 1;
  const geo = new Geometry();
  const put = (across, run, row, facing) => {
    const [x3, z] = ridge === "x" ? [run, across] : [across, run];
    const y = y0 + row;
    let mat = body;
    if (verge && (run === runLo || run === runHi)) mat = verge;
    else if (eave && row === 0) mat = eave;
    const b = mat(x3, y, z);
    geo.set(x3, y, z, withProps(b, { facing, ...halfDefault(b) }));
  };
  for (let row = 0; row < Math.floor(span / 2); row++) {
    for (let run = runLo; run <= runHi; run++) {
      put(lo + row, run, row, faceLo);
      put(hi - row, run, row, faceHi);
    }
  }
  if (span % 2) {
    const row = Math.floor(span / 2);
    for (let run = runLo; run <= runHi; run++)
      put(lo + row, run, row, faceHi);
  }
  return geo;
}
function roofHip(c1, c2, block, options) {
  const [[x1, y0, z1], [x2, , z2]] = corners("roof_hip", c1, c2);
  const stair = stairMaterial("roof_hip", block, options.seed);
  const hipP = new Painter(options.hip, options.seed);
  const capP = new Painter(options.cap ?? options.hip, options.seed);
  const geo = new Geometry();
  let k = 0;
  while (x1 + k <= x2 - k && z1 + k <= z2 - k) {
    const [a, b, c, d, y] = [x1 + k, x2 - k, z1 + k, z2 - k, y0 + k];
    if (a === b || c === d) {
      for (let x3 = a; x3 <= b; x3++) for (let z = c; z <= d; z++) capP.put(x3, y, z);
      break;
    }
    for (let x3 = a + 1; x3 < b; x3++) {
      geo.set(x3, y, c, withProps(stair(x3, y, c), { facing: "south", half: "bottom" }));
      geo.set(x3, y, d, withProps(stair(x3, y, d), { facing: "north", half: "bottom" }));
    }
    for (let z = c + 1; z < d; z++) {
      geo.set(a, y, z, withProps(stair(a, y, z), { facing: "east", half: "bottom" }));
      geo.set(b, y, z, withProps(stair(b, y, z), { facing: "west", half: "bottom" }));
    }
    for (const [x3, z] of [
      [a, c],
      [b, c],
      [a, d],
      [b, d]
    ])
      hipP.put(x3, y, z);
    k++;
  }
  return geo.concat(hipP.geo).concat(capP.geo);
}
function slabMaterial(what, block, seed) {
  const at = (x2, y, z) => {
    const b = resolveMaterial(block, x2, y, z, seed);
    if (parse(b).props.has("type")) {
      throw new McbuilderError(
        `${what} computes slab 'type' from the geometry; pass the slab block without a type property`
      );
    }
    return b;
  };
  at(0, 0, 0);
  return at;
}
var ARCH_PROFILES = ["stepped", "segmental", "pointed"];
function arch(start, width, block, options) {
  const [sx, sy, sz] = point("arch: start", start);
  const w = positive("arch: width", width, 2);
  const { axis, profile, seed } = options;
  if (axis !== "x" && axis !== "z") {
    throw new McbuilderError(`arch: axis must be 'x' or 'z', got ${String(axis)}`);
  }
  if (!ARCH_PROFILES.includes(profile)) {
    throw new McbuilderError(
      `arch: profile must be one of [${ARCH_PROFILES.join(", ")}], got ${String(profile)}`
    );
  }
  const depth = positive("arch: depth", options.depth ?? 1);
  const half = Math.floor(w / 2);
  let rise;
  if (profile === "segmental") {
    rise = positive("arch: rise", options.rise ?? 2, 2);
    if (w < 2 * rise - 1) {
      throw new McbuilderError(
        `arch: segmental with rise ${rise} needs width >= ${2 * rise - 1}, got ${w}; use 'stepped' or 'pointed' for a narrower span`
      );
    }
  } else if (profile === "pointed") {
    rise = half;
    if (options.rise !== void 0 && options.rise !== rise) {
      throw new McbuilderError(
        `arch: pointed closes at rise ${rise} for width ${w} (floor(width / 2)); got rise ${show(options.rise)}, use 'stepped' for a flat-topped staircase`
      );
    }
  } else {
    rise = positive("arch: rise", options.rise ?? Math.min(2, half));
    if (rise > half) {
      throw new McbuilderError(
        `arch: stepped with width ${w} allows rise <= ${half}, got ${rise}; the two sides would cross`
      );
    }
  }
  if (profile === "stepped" && options.slab !== void 0) {
    throw new McbuilderError("arch: slab is not used by the 'stepped' profile");
  }
  if (profile === "pointed" && options.slab === void 0) {
    throw new McbuilderError("arch: the 'pointed' profile requires a slab block");
  }
  const stair = stairMaterial("arch", block, seed);
  const slab = options.slab ? slabMaterial("arch", options.slab, seed) : null;
  const spandrel = options.fill ? new Painter(options.fill, seed) : null;
  const geo = new Geometry();
  const apexCap = profile === "pointed" && w % 2 === 1 ? slab : null;
  const [leftFacing, rightFacing] = axis === "x" ? ["west", "east"] : ["north", "south"];
  const cell = (col, row, layer) => axis === "x" ? [sx + col, sy + row, sz + layer] : [sx + layer, sy + row, sz + col];
  for (let layer = 0; layer < depth; layer++) {
    for (let row = 0; row < rise; row++) {
      const crown = profile === "segmental" && row === rise - 1;
      for (let col = 0; col < w; col++) {
        const [x2, y, z] = cell(col, row, layer);
        if (col < row || col > w - 1 - row) {
          spandrel?.put(x2, y, z);
        } else if (crown) {
          if (slab) geo.set(x2, y, z, withProps(slab(x2, y, z), { type: "bottom" }));
        } else if (apexCap && row === rise - 1 && col === half) {
          geo.set(x2, y, z, withProps(apexCap(x2, y, z), { type: "top" }));
        } else if (col === row || col === w - 1 - row) {
          const facing = col === row ? leftFacing : rightFacing;
          geo.set(x2, y, z, withProps(stair(x2, y, z), { facing, half: "top" }));
        }
      }
    }
  }
  return spandrel ? spandrel.geo.concat(geo) : geo;
}
function parapet(c1, c2, block, options = {}) {
  const [[x1, y0, z1], [x2, , z2]] = corners("parapet", c1, c2);
  const merlon = positive("parapet: merlon", options.merlon ?? 1);
  const crenel = positive("parapet: crenel", options.crenel ?? 1);
  const height = positive("parapet: height", options.height ?? 1);
  const base = positive("parapet: base", options.base ?? 1, 0);
  const { seed } = options;
  const corbel = options.corbel === void 0 ? null : stairMaterial("parapet", options.corbel, seed);
  if (corbel && (x1 === x2 || z1 === z2)) {
    throw new McbuilderError(
      "parapet: corbel needs a footprint at least 2 x 2; a straight run has no inside to step out from"
    );
  }
  const grow = corbel ? 1 : 0;
  const [rx1, rx2, rz1, rz2] = [x1 - grow, x2 + grow, z1 - grow, z2 + grow];
  const period = merlon + crenel;
  const isMerlon = (x3, z) => {
    const onZEdge = z === rz1 || z === rz2 || rz1 === rz2;
    const d = onZEdge ? Math.min(x3 - rx1, rx2 - x3) : Math.min(z - rz1, rz2 - z);
    return d % period < merlon;
  };
  const p = new Painter(block, seed);
  const geo = new Geometry();
  for (let x3 = rx1; x3 <= rx2; x3++) {
    for (let z = rz1; z <= rz2; z++) {
      const onRing = x3 === rx1 || x3 === rx2 || z === rz1 || z === rz2;
      if (!onRing) continue;
      for (let row = 0; row < base; row++) p.put(x3, y0 + row, z);
      if (isMerlon(x3, z)) for (let row = 0; row < height; row++) p.put(x3, y0 + base + row, z);
      if (corbel) {
        const facing = x3 === rx1 ? "east" : x3 === rx2 ? "west" : z === rz1 ? "south" : "north";
        geo.set(x3, y0 - 1, z, withProps(corbel(x3, y0 - 1, z), { facing, half: "top" }));
      }
    }
  }
  return geo.concat(p.geo);
}
function skirtRoof(c1, c2, block, options = {}) {
  const [[x1, y0, z1], [x2, , z2]] = corners("skirt_roof", c1, c2);
  const overhang = positive("skirt_roof: overhang", options.overhang ?? 2);
  const courses = positive("skirt_roof: courses", options.courses ?? 2, 0);
  const { seed } = options;
  let hole = null;
  if (options.hole !== void 0) {
    if (!Array.isArray(options.hole) || options.hole.length !== 2) {
      throw new McbuilderError(
        `skirt_roof: hole must be two corner points, got ${show(options.hole)}`
      );
    }
    const [[hx1, , hz1], [hx2, , hz2]] = corners("skirt_roof", options.hole[0], options.hole[1]);
    if (hx1 < x1 || hx2 > x2 || hz1 < z1 || hz2 > z2) {
      throw new McbuilderError(
        `skirt_roof: hole [${[hx1, hz1].join(", ")}]..[${[hx2, hz2].join(", ")}] (x, z) must lie inside the footprint [${[x1, z1].join(", ")}]..[${[x2, z2].join(", ")}]`
      );
    }
    hole = [hx1, hx2, hz1, hz2];
  }
  const slab = options.slab ? slabMaterial("skirt_roof", options.slab, seed) : null;
  const body = new Painter(block, seed);
  const rim = options.rim ? new Painter(options.rim, seed) : body;
  const dentil = options.dentil === null ? null : new Painter(options.dentil ?? block, seed);
  const geo = new Geometry();
  const [ox1, ox2, oz1, oz2] = [x1 - overhang, x2 + overhang, z1 - overhang, z2 + overhang];
  const r = y0 + (dentil ? 1 : 0);
  for (let x3 = ox1; x3 <= ox2; x3++) {
    for (let z = oz1; z <= oz2; z++) {
      if (hole && x3 >= hole[0] && x3 <= hole[1] && z >= hole[2] && z <= hole[3]) continue;
      const ring = Math.min(x3 - ox1, ox2 - x3, z - oz1, oz2 - z);
      if (ring === 0) {
        if (dentil) {
          const onZEdge = z === oz1 || z === oz2;
          const d = onZEdge ? Math.min(x3 - ox1, ox2 - x3) : Math.min(z - oz1, oz2 - z);
          if (d % 2 === 0) dentil.put(x3, y0, z);
        }
        rim.put(x3, r, z);
        continue;
      }
      if (dentil) body.put(x3, y0, z);
      const level = Math.min(ring, courses);
      const full = slab ? Math.floor(level / 2) : level;
      for (let row = 0; row <= full; row++) body.put(x3, r + row, z);
      if (slab && level % 2 === 1) {
        const y = r + full + 1;
        geo.set(x3, y, z, withProps(slab(x3, y, z), { type: "bottom" }));
      }
    }
  }
  let out = geo.concat(body.geo);
  if (rim !== body) out = out.concat(rim.geo);
  if (dentil) out = out.concat(dentil.geo);
  return out;
}

// packages/mcbuilder/src/voxels.ts
var VoxelGrid = class _VoxelGrid {
  volume = new Volume();
  maxDims;
  overwrites = 0;
  constructor(maxDims = [256, 256, 256]) {
    if (maxDims.length !== 3 || maxDims.some((d) => !Number.isInteger(d) || d <= 0)) {
      throw new RangeError(`max_dims must be 3 positive ints, got [${maxDims.join(", ")}]`);
    }
    this.maxDims = [...maxDims];
  }
  /** Cells where a real block was replaced by a different real block. */
  get overwriteCount() {
    return this.overwrites;
  }
  checkBounds(x2, y, z) {
    const axes = ["x", "y", "z"];
    [x2, y, z].forEach((value, i2) => {
      const allowed = this.maxDims[i2];
      if (!(-allowed <= value && value < allowed)) {
        throw new GridBoundsError(
          `axis ${axes[i2]}: coordinate ${value} out of bounds (allowed -${allowed}..${allowed - 1} for max dimension ${allowed})`
        );
      }
    });
  }
  /** Place a canonical block string. Last write wins. */
  place(x2, y, z, canonical2) {
    for (const v of [x2, y, z]) {
      if (typeof v !== "number" || !Number.isInteger(v)) {
        throw new TypeError(`voxel coordinates must be ints, got ${String(v)}`);
      }
    }
    this.checkBounds(x2, y, z);
    const old = this.volume.get(x2, y, z);
    if (old !== void 0 && old !== canonical2 && old !== AIR && canonical2 !== AIR) {
      this.overwrites++;
    }
    this.volume.set(x2, y, z, canonical2);
  }
  /** Make a cell unset. */
  unset(x2, y, z) {
    this.volume.unset(x2, y, z);
  }
  /** Move every placed cell. */
  shift(dx, dy, dz) {
    this.volume.translate(dx, dy, dz);
  }
  /** Inclusive bounding box over non-air cells, or `null`. */
  bounds() {
    return this.volume.bounds();
  }
  /** The placed region as a dense array (see `Volume.toDense`). */
  toDense() {
    return this.volume.toDense();
  }
  /** A new grid with only the cells inside the box `c1`..`c2`. */
  crop(c1, c2) {
    const lo = [0, 1, 2].map((i2) => Math.min(c1[i2], c2[i2]));
    const hi = [0, 1, 2].map((i2) => Math.max(c1[i2], c2[i2]));
    const out = new _VoxelGrid(this.maxDims);
    this.volume.eachCell((x2, y, z, idx) => {
      if (x2 >= lo[0] && x2 <= hi[0] && y >= lo[1] && y <= hi[1] && z >= lo[2] && z <= hi[2]) {
        out.place(x2, y, z, this.volume.palette[idx]);
      }
    });
    return out;
  }
};

// packages/mcbuilder/src/build.ts
function ints(what, p) {
  if (!Array.isArray(p) || p.length !== 3)
    throw new BuildError(`${what} must be 3 ints, got ${String(p)}`);
  if (!p.every((v) => typeof v === "number" && Number.isInteger(v))) {
    throw new BuildError(`${what} coordinates must be ints, got [${p.join(", ")}]`);
  }
  return p;
}
var Build = class {
  seedValue;
  sharedRng = null;
  voxelGrid;
  depth = 0;
  views = null;
  constructor(options = {}) {
    this.seedValue = options.seed ?? null;
    this.voxelGrid = new VoxelGrid(options.maxDimensions ?? [256, 256, 256]);
    if (options.views !== void 0) this.setViews(options.views);
  }
  /** Run `fn` with placements enabled. Scopes nest. */
  scope(fn) {
    this.depth++;
    try {
      return fn(this);
    } finally {
      this.depth = Math.max(0, this.depth - 1);
    }
  }
  requireScope() {
    if (this.depth === 0) throw new BuildError("placements must be inside `build.scope(...)`");
  }
  // -- primitives -------------------------------------------------------------
  /** Place one block (any material spec). Last write wins. `minecraft:air` places explicit air. */
  set(x2, y, z, block) {
    this.requireScope();
    this.voxelGrid.place(x2, y, z, resolveMaterial(block, x2, y, z, this.seedValue));
  }
  /** Make every placed cell in the box `c1`..`c2` unset, so pasting leaves the world untouched there. */
  carve(c1, c2) {
    this.requireScope();
    const [x1, y1, z1] = ints("carve: c1", c1);
    const [x2, y2, z2] = ints("carve: c2", c2);
    for (let x3 = Math.min(x1, x2); x3 <= Math.max(x1, x2); x3++) {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) this.voxelGrid.unset(x3, y, z);
      }
    }
  }
  /**
   * Stamp `geometry` with its origin at `at`. Returns what was placed, in
   * absolute coordinates. `rotation` turns the geometry about its origin
   * first; `facing`, `axis` and friends rotate with it.
   */
  place(geometry, options = {}) {
    this.requireScope();
    if (!(geometry instanceof Geometry)) throw new BuildError("place: expected a Geometry");
    const rotation = options.rotation ?? "NONE";
    const [ax, ay, az] = ints("place: at", options.at ?? [0, 0, 0]);
    const placed = [];
    for (const cell of geometry.cells()) {
      let [dx, , dz] = cell;
      const dy = cell[1];
      let block = cell[3];
      if (rotation !== "NONE") {
        [dx, dz] = rotatePoint(dx, dz, 0, 0, rotation);
        block = rotateBlockstate(block, rotation);
      } else {
        rotatePoint(0, 0, 0, 0, rotation);
      }
      const x2 = ax + dx;
      const y = ay + dy;
      const z = az + dz;
      this.voxelGrid.place(x2, y, z, block);
      placed.push([x2, y, z, block]);
    }
    return Geometry.fromCells(placed);
  }
  /** Shift the build so its XZ bounding-box centre is at the origin (Y unchanged). */
  recenter() {
    const bb = this.voxelGrid.bounds();
    if (bb === null) return;
    const [[minx, , minz], [maxx, , maxz]] = bb;
    this.voxelGrid.shift(-Math.floor((minx + maxx + 1) / 2), 0, -Math.floor((minz + maxz + 1) / 2));
  }
  // -- reading the build back ---------------------------------------------------
  /** Canonical block at `(x, y, z)`; `null` if unset or air. */
  get(x2, y, z) {
    const b = this.voxelGrid.volume.get(x2, y, z);
    return b === void 0 || b === AIR ? null : b;
  }
  /** Number of cells holding exactly `block` (property order ignored). */
  count(block) {
    const canonical2 = canonicalize(block);
    let n2 = 0;
    const palette = this.voxelGrid.volume.palette;
    this.voxelGrid.volume.eachCell((_x, _y, _z, idx) => {
      if (palette[idx] === canonical2) n2++;
    });
    return n2;
  }
  /** Sorted coordinates of every cell holding exactly `block`. */
  find(block) {
    const canonical2 = canonicalize(block);
    const out = [];
    const palette = this.voxelGrid.volume.palette;
    this.voxelGrid.volume.eachCell((x2, y, z, idx) => {
      if (palette[idx] === canonical2) out.push([x2, y, z]);
    });
    return out.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  }
  /** Bounding box of placed non-air cells, or `null`. */
  bounds() {
    return this.voxelGrid.bounds();
  }
  // -- randomness and config ------------------------------------------------------
  /**
   * Seeded random generator. `rng()` is one shared stream; `rng("roof")` is
   * an independent stream for that name, so editing one part of a script
   * does not reshuffle the random choices of every other part.
   */
  rng(namespace) {
    if (namespace === void 0) {
      this.sharedRng ??= this.seedValue === null ? Rng.unseeded() : new Rng(String(this.seedValue));
      return this.sharedRng;
    }
    if (typeof namespace !== "string")
      throw new BuildError(`rng: namespace must be a string, got ${String(namespace)}`);
    return new Rng(
      `${this.seedValue === null ? "None" : String(this.seedValue)}\0${namespace}`
    );
  }
  setViews(views) {
    this.views = views === null ? null : typeof views === "string" ? [views] : [...views];
  }
  get grid() {
    return this.voxelGrid;
  }
  get seed() {
    return this.seedValue;
  }
  get viewsConfig() {
    return this.views;
  }
  // -- shapes: each places the geometry and returns it ----------------------------
  stamp(g) {
    return this.place(g);
  }
  opt(o) {
    return { seed: this.seedValue, ...o };
  }
  box(c1, c2, block, o) {
    return this.stamp(box(c1, c2, block, this.opt(o)));
  }
  walls(c1, c2, block, o) {
    return this.stamp(walls(c1, c2, block, this.opt(o)));
  }
  pillar(base, height, block, o) {
    return this.stamp(pillar(base, height, block, this.opt(o)));
  }
  line(p1, p2, block, o) {
    return this.stamp(line(p1, p2, block, this.opt(o)));
  }
  /**
   * One-block-thick slab at the lower Y of the corners `c1` and `c2`, covering
   * their XZ rectangle. Corners may be in any order. Port of Python
   * `Build.floor`: a `box` of height 1, so a palette spec resolves with the
   * Build seed.
   */
  floor(c1, c2, block, o) {
    const [x1, y1, z1] = ints("floor: c1", c1);
    const [x2, y2, z2] = ints("floor: c2", c2);
    const y = Math.min(y1, y2);
    return this.box(
      [Math.min(x1, x2), y, Math.min(z1, z2)],
      [Math.max(x1, x2), y, Math.max(z1, z2)],
      block,
      o
    );
  }
  /** Straight horizontal run from `start` to `end`, axis-aligned only; see `shapes.railing`. */
  railing(start, end, block, o) {
    return this.stamp(railing(start, end, block, this.opt(o)));
  }
  stairs(start, direction2, block, o) {
    return this.stamp(stairs(start, direction2, block, this.opt(o)));
  }
  /** Script-port alias of `stairs`; see `shapes.stairsRun` for the Python provenance and the facing divergence. */
  stairsRun(start, direction2, block, o) {
    return this.stamp(stairsRun(start, direction2, block, this.opt(o)));
  }
  cylinder(center, radius, height, block, o) {
    return this.stamp(cylinder(center, radius, height, block, this.opt(o)));
  }
  sphere(center, radius, block, o) {
    return this.stamp(sphere(center, radius, block, this.opt(o)));
  }
  cone(center, radius, height, block, o) {
    return this.stamp(cone(center, radius, height, block, this.opt(o)));
  }
  roofGable(c1, c2, block, o) {
    return this.stamp(roofGable(c1, c2, block, this.opt(o)));
  }
  roofHip(c1, c2, block, o) {
    return this.stamp(roofHip(c1, c2, block, this.opt(o)));
  }
};

// packages/mcbuilder/src/node/script.ts
var ScriptError = class extends McbuilderError {
  /** What the script threw, when it threw. */
  thrown;
  constructor(message, thrown) {
    super(message);
    this.thrown = thrown;
  }
};
var exists2 = (p) => stat3(p).then(
  () => true,
  () => false
);
async function loadScript(path) {
  const abs = resolve2(path);
  if (!await exists2(abs)) throw new ScriptError(`no such script: ${path}`);
  let mod;
  try {
    mod = await import(`${pathToFileURL(abs).href}?t=${Date.now()}`);
  } catch (e) {
    throw new ScriptError(
      `error in ${basename(path)}: ${e instanceof Error ? e.message : String(e)}`,
      e
    );
  }
  const build = mod.BUILD ?? mod.default;
  if (!(build instanceof Build)) {
    throw new ScriptError(
      `${basename(path)} must export a Build as BUILD (export const BUILD = new Build(...))`
    );
  }
  return build;
}
function scanDeterminism(source, filename) {
  const hint = "use BUILD.rng() (from new Build({ seed })) for deterministic randomness";
  const checks = [
    [/\bMath\.random\s*\(/, "uses 'Math.random'"],
    [/\bDate\.now\s*\(|\bnew\s+Date\s*\(/, "uses the current time"],
    [/\bcrypto\.(randomUUID|getRandomValues|randomInt|randomBytes)\b/, "uses 'crypto' randomness"]
  ];
  const out = [];
  for (const [re, what] of checks) if (re.test(source)) out.push(`${filename}: ${what} — ${hint}`);
  return out;
}
function blockCounts(dense) {
  const counts = {};
  for (const v of dense.data) {
    if (v < 0) continue;
    const name = dense.palette[v];
    if (name === "minecraft:air") continue;
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return counts;
}
function dimensions(build, dense) {
  const b = build.grid.bounds();
  if (b === null) return [...dense.size];
  return [b[1][0] - b[0][0] + 1, b[1][1] - b[0][1] + 1, b[1][2] - b[0][2] + 1];
}

// packages/mcbuilder/src/node/cli.ts
var CliError = class extends Error {
};
var defaultCacheRoot = (home) => join5(home, ".cache", "mcbuilder");
var HOUSE_TEMPLATE = `// house.ts: starter build written by \`mcbuild init\`.
//
// Loop:  mcbuild check house.ts   ->   mcbuild run house.ts
// Change numbers, run again.
import { Build, patches } from "@voxwright/mcbuilder";

export const BUILD = new Build({ seed: 1, views: "iso;az225_el025;top" });

const WALL = patches([["minecraft:oak_planks", 3], "minecraft:stripped_oak_wood"], { scale: 3 });

BUILD.scope(() => {
  // 7 x 5 footprint: cobblestone floor, plank walls 3 high
  BUILD.box([0, 0, 0], [6, 0, 4], "minecraft:cobblestone");
  BUILD.walls([0, 1, 0], [6, 3, 4], WALL);
  for (const [x, z] of [[0, 0], [6, 0], [0, 4], [6, 4]] as const) {
    BUILD.pillar([x, 1, z], 3, "minecraft:oak_log[axis=y]");
  }

  // door (north wall) and a window (south wall)
  BUILD.set(3, 1, 0, "minecraft:oak_door[facing=north,half=lower,hinge=left]");
  BUILD.set(3, 2, 0, "minecraft:oak_door[facing=north,half=upper,hinge=left]");
  BUILD.box([2, 2, 4], [4, 2, 4], "minecraft:glass_pane");

  // gable roof with a 1-block overhang; shapes return what they placed,
  // so the chimney can be sized from the roof's real peak
  const roof = BUILD.roofGable([-1, 4, -1], [7, 4, 5], "minecraft:spruce_stairs", {
    ridge: "x",
    verge: "minecraft:dark_oak_stairs",
  });
  const peak = roof.bounds()?.[1][1] ?? 4;
  BUILD.box([5, 1, 3], [5, peak + 1, 3], "minecraft:cobblestone");
});
`;
async function findConfig(startDir, home) {
  let dir = resolve3(startDir);
  for (; ; ) {
    const candidate = join5(dir, "mcbuild.toml");
    if (await exists2(candidate)) {
      try {
        return parseConfig(await readFile2(candidate, "utf8"), { home, source: candidate });
      } catch (e) {
        throw new CliError(`invalid mcbuild.toml: ${e.message}`);
      }
    }
    const parent = dirname2(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
async function resolveConfig(scriptPath, explicit, home) {
  if (explicit) {
    if (!await exists2(explicit)) throw new CliError(`config not found: ${explicit}`);
    try {
      return parseConfig(await readFile2(explicit, "utf8"), { home, source: explicit });
    } catch (e) {
      throw new CliError(`invalid config ${explicit}: ${e.message}`);
    }
  }
  return await findConfig(dirname2(resolve3(scriptPath)), home) ?? parseConfig("", { home });
}
function cacheRoot(cfg, home) {
  return cfg.assetsDir ?? defaultCacheRoot(home);
}
async function loadRegistry(cfg, home) {
  const path = join5(cacheRoot(cfg, home), cfg.mcVersion, "minecraft-data.json");
  if (!await exists2(path)) {
    throw new CliError(
      new RegistryError(
        `block registry for version '${cfg.mcVersion}' not found at ${path} — run \`mcbuild assets fetch --version ${cfg.mcVersion}\` first.`
      ).message
    );
  }
  try {
    return Registry.fromData(JSON.parse(await readFile2(path, "utf8")), cfg.mcVersion);
  } catch (e) {
    throw new CliError(`could not read registry file ${path}: ${e.message}`);
  }
}
function parseFocus(spec) {
  const bad = () => {
    throw new CliError(`--focus must look like x0,y0,z0:x1,y1,z1, got '${spec}'`);
  };
  const parts = spec.split(":");
  if (parts.length !== 2) return bad();
  const corner = (t) => {
    const v = t.split(",").map((n2) => /^\s*-?\d+\s*$/.test(n2) ? Number(n2) : Number.NaN);
    if (v.length !== 3 || v.some(Number.isNaN)) return bad();
    return v;
  };
  return [corner(parts[0]), corner(parts[1])];
}
function resolveCliViews(spec, count, scripted) {
  try {
    let views = spec ? resolveViews(spec) : scripted && scripted.length > 0 ? resolveViews(scripted) : resolveViews(null);
    if (count) views = withCount(views, Number(count));
    if (views.length === 0) throw new CliError("no views configured");
    return views;
  } catch (e) {
    if (e instanceof ViewError || e instanceof RangeError)
      throw new CliError(`invalid views: ${e.message}`);
    throw e;
  }
}
function fmtIssue(issue) {
  let msg = String(issue.message ?? JSON.stringify(issue));
  if (issue.at) msg += ` (at ${issue.at})`;
  const sugs = issue.suggestions ?? [];
  if (sugs.length > 0) msg += ` — did you mean ${sugs.join(" or ")}?`;
  return msg;
}
async function loadAndValidate(script, config, home) {
  const build = await loadScript(script);
  const cfg = await resolveConfig(script, config, home);
  const detWarnings = scanDeterminism(await readFile2(script, "utf8"), basename2(script));
  const registry = await loadRegistry(cfg, home);
  const dense = build.grid.toDense();
  const { errors, warnings } = registry.validate(dense.palette, cfg.allowlist);
  return {
    build,
    cfg,
    dense,
    errors,
    warnings: [...warnings, ...detWarnings.map((message) => ({ message }))]
  };
}
async function nextRunDir(out) {
  await mkdir2(out, { recursive: true });
  let n2 = 1;
  while (await exists2(join5(out, `run-${String(n2).padStart(3, "0")}`))) n2++;
  const dir = join5(out, `run-${String(n2).padStart(3, "0")}`);
  await mkdir2(dir);
  return dir;
}
async function cmdCheck(args, io) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { config: { type: "string" } }
  });
  const [script] = positionals;
  if (script === void 0) throw new CliError("check: give a script");
  const ctx = await loadAndValidate(script, values.config, io.home);
  const blocks = ctx.build.grid.volume.countNonAir();
  io.out(
    `${basename2(script)} — ${ctx.errors.length === 0 ? "OK" : "FAILED"} (${blocks} blocks, ${ctx.dense.palette.length} types, ${ctx.errors.length} errors, ${ctx.warnings.length} warnings)`
  );
  for (const e of ctx.errors) io.out(`  error: ${fmtIssue(e)}`);
  for (const w of ctx.warnings) io.out(`  warning: ${fmtIssue(w)}`);
  return ctx.errors.length > 0 ? 1 : 0;
}
async function cmdRun(args, io, get) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      config: { type: "string" },
      out: { type: "string", default: "dist" },
      air: { type: "string", default: "none" },
      preview: { type: "boolean" },
      tier: { type: "string", default: "faithful" },
      focus: { type: "string" },
      views: { type: "string" },
      count: { type: "string" },
      guide: { type: "boolean" },
      offline: { type: "boolean" }
    }
  });
  const [script] = positionals;
  if (script === void 0) throw new CliError("run: give a script");
  if (values.tier !== "faithful") {
    if (["fast", "trusted", "all"].includes(values.tier)) {
      throw new CliError(
        `--tier ${values.tier} is not ported yet; only faithful previews exist (the default)`
      );
    }
    throw new CliError(`--tier must be faithful, fast, trusted or all, got '${values.tier}'`);
  }
  const air = values.air;
  if (!["none", "explicit", "all"].includes(air))
    throw new CliError("--air must be none, explicit or all");
  const ctx = await loadAndValidate(script, values.config, io.home);
  const runDir = await nextRunDir(resolve3(io.cwd, values.out));
  const stem = basename2(script, extname(script));
  const warnings = [...ctx.warnings];
  let focus = null;
  if (values.focus) focus = parseFocus(values.focus);
  const viewList = values.preview ? resolveCliViews(values.views, values.count, ctx.build.viewsConfig) : [];
  const artifacts = [];
  if (ctx.errors.length === 0) {
    const versionDir = resolveAssetsDir(ctx.cfg, io.home).replace(/[\\/]+$/, "");
    const candidates = [join5(versionDir, "version.json")];
    if (ctx.cfg.assetsDir) candidates.push(join5(versionDir, ctx.cfg.mcVersion, "version.json"));
    let versionJson;
    for (const vj of candidates) {
      if (await exists2(vj)) {
        versionJson = JSON.parse(await readFile2(vj, "utf8"));
        break;
      }
    }
    let dataVersion;
    try {
      dataVersion = resolveDataVersion(ctx.cfg.mcVersion, versionJson);
    } catch (e) {
      if (e instanceof ExportError) throw new CliError(e.message);
      throw e;
    }
    let result;
    try {
      result = await writeStructureNbt(ctx.build.grid.volume, { dataVersion, air });
    } catch (e) {
      throw new CliError(e instanceof Error ? e.message : String(e));
    }
    await writeFile2(join5(runDir, `${stem}.nbt`), result.bytes);
    warnings.push(...result.warnings.map((message) => ({ message })));
    artifacts.push({ file: `${stem}.nbt`, format: "nbt", data_version: dataVersion });
  }
  const viewEntries = [];
  if (values.preview && ctx.errors.length === 0) {
    const root = join5(
      ctx.cfg.assetsDir ?? defaultCacheRoot(io.home),
      ctx.cfg.mcVersion,
      "client",
      "assets",
      "minecraft"
    );
    let haveAssets = await exists2(join5(root, "blockstates"));
    let why = "";
    if (!haveAssets && !ctx.cfg.assetsDir && !values.offline) {
      io.out(
        `downloading the vanilla assets for ${ctx.cfg.mcVersion} (once, for the previews; --offline skips this)`
      );
      try {
        await fetchClientAssets(ctx.cfg.mcVersion, defaultCacheRoot(io.home), {
          ...get ? { get } : {}
        });
        haveAssets = await exists2(join5(root, "blockstates"));
      } catch (e) {
        if (!(e instanceof AssetError)) throw e;
        why = ` (download failed: ${e.message})`;
      }
    }
    if (!haveAssets) {
      warnings.push({
        message: `faithful preview: vanilla client assets not found — all blocks rendered as fallback cubes${why}`
      });
    }
    const grid = focus === null ? ctx.build.grid : ctx.build.grid.crop(focus[0], focus[1]);
    if (focus !== null && grid.volume.countNonAir() === 0)
      throw new CliError(`--focus ${values.focus}: no blocks inside that box`);
    const dense = grid.toDense();
    const assets = haveAssets ? directoryAssets(root) : null;
    for (const [name, n2] of untrustedBlocks(dense, assets)) {
      warnings.push({
        message: `faithful preview: ${n2} \`${name}\` rendered as magenta fallback cube — orientation not verified`
      });
    }
    const dir = join5(runDir, "previews_faithful");
    await mkdir2(dir, { recursive: true });
    for (const view of viewList) {
      const file = `${view.label}.png`;
      await writeFile2(
        join5(dir, file),
        encodePng(renderView(dense, assets, view, { title: titleCase(stem.replaceAll("_", " ")) }))
      );
      viewEntries.push(
        viewEntry({
          file: `previews_faithful/${file}`,
          view,
          directionsUntrusted: false,
          directionsTrusted: true
        })
      );
    }
  }
  if (values.guide && ctx.errors.length === 0) {
    const root = join5(
      ctx.cfg.assetsDir ?? defaultCacheRoot(io.home),
      ctx.cfg.mcVersion,
      "client",
      "assets",
      "minecraft"
    );
    const haveAssets = await exists2(join5(root, "blockstates"));
    const grid = focus === null ? ctx.build.grid : ctx.build.grid.crop(focus[0], focus[1]);
    const iso = join5(runDir, "previews_faithful", "iso.png");
    const guide = buildGuide(grid.toDense(), haveAssets ? directoryAssets(root) : null, {
      title: titleCase(stem.replaceAll("_", " ")),
      cover: await exists2(iso) ? "../previews_faithful/iso.png" : null
    });
    const dir = join5(runDir, "guide");
    await mkdir2(dir, { recursive: true });
    for (const layer of guide.layers)
      await writeFile2(join5(dir, layer.name), encodePng(layer.image));
    await writeFile2(join5(dir, "guide.md"), guide.markdown, "utf8");
    artifacts.push({ file: "guide/guide.md", format: "guide" });
  }
  const placed = ctx.build.grid.volume.placedBounds();
  const report = buildReport({
    errors: ctx.errors,
    warnings,
    blockCounts: blockCounts(ctx.dense),
    dimensions: dimensions(ctx.build, ctx.dense),
    views: viewEntries,
    runDir,
    artifacts,
    overwrittenPlacements: ctx.build.grid.overwriteCount,
    origin: placed === null ? [0, 0, 0] : [...placed[0]]
  });
  await writeFile2(join5(runDir, "report.json"), reportToJson(report), "utf8");
  const dims = dimensions(ctx.build, ctx.dense);
  let line2 = `  ${ctx.build.grid.volume.countNonAir()} blocks, ${ctx.dense.palette.length} types, dims ${dims.join("x")} — ${ctx.errors.length} errors, ${warnings.length} warnings`;
  if (ctx.build.grid.overwriteCount)
    line2 += `, ${ctx.build.grid.overwriteCount} placements overwritten`;
  io.out(`run dir: ${runDir}`);
  io.out(line2);
  if (viewEntries.length > 0) {
    io.out(`  faithful previews: ${viewEntries.length} in previews_faithful/`);
  }
  for (const a of artifacts) {
    if (a.format === "guide") io.out(`  guide: ${a.file}`);
    else io.out(`  artifact: ${a.file} (${a.format}, DataVersion ${a.data_version})`);
  }
  for (const e of ctx.errors) io.out(`  error: ${fmtIssue(e)}`);
  for (const w of warnings) io.out(`  warning: ${fmtIssue(w)}`);
  return ctx.errors.length > 0 ? 1 : 0;
}
async function cmdImport(args, io) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      output: { type: "string", short: "o" },
      force: { type: "boolean" },
      "keep-air": { type: "boolean" },
      raw: { type: "boolean" },
      config: { type: "string" }
    }
  });
  const [file] = positionals;
  if (file === void 0) throw new CliError("import: give a file");
  if (!await exists2(file)) throw new CliError(`no such file: ${file}`);
  const out = values.output ?? `${file.slice(0, file.length - extname(file).length)}.ts`;
  if (await exists2(out) && !values.force)
    throw new CliError(`refusing to overwrite ${out} (use --force)`);
  const bytes = new Uint8Array(await readFile2(file));
  const keepAir = values["keep-air"] ?? false;
  let read2;
  try {
    switch (extname(file).toLowerCase()) {
      case ".nbt": {
        const r = await readStructureNbt(bytes, { keepAir });
        read2 = {
          volume: r.volume,
          dataVersion: r.meta.dataVersion,
          be: r.meta.droppedBlockEntities + r.volume.blockEntityCount,
          e: r.meta.droppedEntities + r.volume.entities.length
        };
        break;
      }
      case ".schem": {
        const r = await readSchem(bytes, { keepAir });
        read2 = {
          volume: r.volume,
          dataVersion: r.meta.dataVersion,
          be: r.meta.droppedBlockEntities + r.volume.blockEntityCount,
          e: r.meta.droppedEntities + r.volume.entities.length
        };
        break;
      }
      case ".litematic": {
        const r = await readLitematic(bytes, { keepAir });
        read2 = {
          volume: r.volume,
          dataVersion: r.meta.dataVersion,
          be: r.meta.droppedBlockEntities + r.volume.blockEntityCount,
          e: r.meta.droppedEntities + r.volume.entities.length
        };
        break;
      }
      case ".mcstructure": {
        const r = await readMcstructure(bytes, { keepAir });
        for (const w of r.warnings) io.err(`warning: ${w}`);
        read2 = {
          volume: r.volume,
          dataVersion: null,
          be: r.meta.droppedBlockEntities + r.volume.blockEntityCount,
          e: r.meta.droppedEntities + r.volume.entities.length
        };
        break;
      }
      default:
        throw new CliError(
          `unsupported file type '${extname(file)}' (expected .nbt, .schem, .litematic or .mcstructure)`
        );
    }
  } catch (e) {
    if (e instanceof CliError) throw e;
    throw new CliError(e instanceof Error ? e.message : String(e));
  }
  let structure = structureFromVolume(read2.volume, basename2(file), {
    dataVersion: read2.dataVersion,
    droppedBlockEntities: read2.be,
    droppedEntities: read2.e
  });
  if (!values.raw) {
    try {
      const registry = await loadRegistry(
        await resolveConfig(resolve3(file), values.config, io.home),
        io.home
      );
      structure = cleanProperties(structure, registry);
    } catch (e) {
      io.err(`warning: properties not cleaned (${e.message})`);
    }
  }
  await mkdir2(dirname2(resolve3(out)), { recursive: true });
  await writeFile2(out, toScript(structure), "utf8");
  io.out(`wrote ${out}`);
  for (const line2 of summary(structure, 10)) io.out(line2 ? `  ${line2}` : "");
  return 0;
}
function glueNegativeNumbers(args) {
  const out = [];
  for (let i2 = 0; i2 < args.length; i2++) {
    const a = args[i2];
    const next = args[i2 + 1];
    if (a.startsWith("--") && !a.includes("=") && next !== void 0 && /^-\d+$/.test(next)) {
      out.push(`${a}=${next}`);
      i2++;
    } else out.push(a);
  }
  return out;
}
async function cmdDiff(args, io) {
  const { values, positionals } = parseArgs({
    args: glueNegativeNumbers(args),
    allowPositionals: true,
    options: { out: { type: "string", default: "dist/" }, max: { type: "string", default: "30" } }
  });
  const [runA, runB] = positionals;
  if (runA === void 0 || runB === void 0 || positionals.length !== 2)
    throw new CliError("diff: give two run ids");
  const runsDir = resolve3(io.cwd, values.out);
  if (!(await stat4(runsDir).catch(() => null))?.isDirectory())
    throw new CliError(`runs directory not found: ${runsDir}`);
  const max2 = Number(values.max);
  if (!Number.isInteger(max2) || max2 < 0)
    throw new CliError(`invalid --max: ${values.max} (must be >= 0)`);
  const aDir = await resolveRunDir(runsDir, runA);
  const bDir = await resolveRunDir(runsDir, runB);
  const diff = await diffRunDirs(aDir, bDir);
  io.out(formatDiff(diff, basename2(aDir), basename2(bDir), { maxEntries: max2 }));
  io.out("  comparison: image not ported yet");
  return diff.added.length + diff.removed.length + diff.changed.length === 0 ? 0 : 1;
}
async function cmdInit(args, io) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { force: { type: "boolean" } }
  });
  const raw = positionals[0] ?? "house.ts";
  const target = raw.endsWith(sep2) || raw.endsWith("/") ? join5(raw, "house.ts") : raw;
  const abs = resolve3(io.cwd, target);
  if ((await stat4(abs).catch(() => null))?.isDirectory())
    throw new CliError(`not a file: ${target}`);
  if (await exists2(abs) && !values.force) {
    throw new CliError(
      `refusing to overwrite existing file: ${target} (pass --force to overwrite)`
    );
  }
  await mkdir2(dirname2(abs), { recursive: true });
  await writeFile2(abs, HOUSE_TEMPLATE, "utf8");
  io.out(`wrote ${target}`);
  io.out(`next: mcbuild check ${target}`);
  io.out(`then: mcbuild run ${target}`);
  return 0;
}
async function cmdAssets(args, io, get) {
  const [sub, ...rest] = args;
  if (sub !== "fetch") throw new CliError("assets: expected `fetch`");
  const { values } = parseArgs({
    args: rest,
    options: {
      version: { type: "string" },
      "cache-dir": { type: "string" },
      force: { type: "boolean" },
      from: { type: "string", default: "mcasset" }
    }
  });
  if (!values.version) throw new CliError("assets fetch: --version is required");
  if (!ASSET_SOURCES.includes(values.from))
    throw new CliError("assets fetch: --from must be mcasset or mojang");
  const cacheDir = values["cache-dir"] ? resolve3(io.cwd, values["cache-dir"].replace(/^~(?=$|\/)/, io.home)) : defaultCacheRoot(io.home);
  try {
    const dest = await fetchAssets(values.version, cacheDir, {
      force: values.force ?? false,
      source: values.from,
      ...get ? { get } : {}
    });
    io.out(
      `fetched ${values.version} -> ${dest} (registry + vanilla client assets: textures, models, blockstates)`
    );
  } catch (e) {
    if (e instanceof AssetError) throw new CliError(`assets fetch failed: ${e.message}`);
    throw e;
  }
  return 0;
}
var RUN_COMMANDS = ["init", "check", "run", "import", "diff", "assets"];
var RUN_SYNTAX = `init [path] [--force]
check <script> [--config file]
run <script> [--out dir] [--air none|explicit|all] [--config file]
    [--preview] [--guide] [--views 'iso;top'] [--count N] [--focus x0,y0,z0:x1,y1,z1]
    [--offline]
import <file> [-o out] [--force] [--keep-air] [--raw]
diff <run-a> <run-b> [--out dir] [--max N]
assets fetch --version V [--from mcasset|mojang] [--cache-dir dir] [--force]`;
var USAGE = `mcbuild: validate and export agent-built Minecraft structures.

${RUN_SYNTAX.split("\n").map((l) => l.startsWith(" ") ? `          ${l}` : `  mcbuild ${l}`).join("\n")}

mcbuild diff does not write its comparison image yet (not ported).`;
async function runCli(argv, io = {}, deps = {}) {
  const full = {
    out: io.out ?? ((l) => console.log(l)),
    err: io.err ?? ((l) => console.error(l)),
    cwd: io.cwd ?? process.cwd(),
    home: io.home ?? homedir()
  };
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case "init":
        return await cmdInit(rest, full);
      case "check":
        return await cmdCheck(rest, full);
      case "run":
        return await cmdRun(rest, full, deps.get);
      case "import":
        return await cmdImport(rest, full);
      case "assets":
        return await cmdAssets(rest, full, deps.get);
      case void 0:
      case "-h":
      case "--help":
        full.out(USAGE);
        return command === void 0 ? 2 : 0;
      case "diff":
        return await cmdDiff(rest, full);
      default:
        full.err(`mcbuild: unknown command '${command}'
${USAGE}`);
        return 2;
    }
  } catch (e) {
    if (e instanceof CliError || e instanceof DiffError || e instanceof McbuilderError) {
      full.err(`mcbuild: ${e.message}`);
      return 1;
    }
    if (e instanceof TypeError && /Unknown option|argument/.test(e.message)) {
      full.err(`mcbuild: ${e.message}`);
      return 2;
    }
    throw e;
  }
}

// packages/mcbuilder/src/node/skill/build.ts
import { mkdir as mkdir3, readFile as readFile4, writeFile as writeFile3 } from "node:fs/promises";
import { basename as basename3, dirname as dirname3, extname as extname3, join as join8, resolve as resolve5 } from "node:path";
import { pathToFileURL as pathToFileURL2 } from "node:url";
import { parseArgs as parseArgs2 } from "node:util";

// packages/mcbuilder/src/node/skill/common.ts
import { join as join6 } from "node:path";

// packages/mcbuilder/src/node/skill/io.ts
var SkillCliError = class extends Error {
  exitCode;
  constructor(message, exitCode = 1) {
    super(message);
    this.name = "SkillCliError";
    this.exitCode = exitCode;
  }
};

// packages/mcbuilder/src/node/skill/common.ts
var PROG = /(^|[\\/])mcbuild(\.mjs|\.ts)?$/.test(process.argv[1] ?? "") ? "mcbuild" : "voxwright-cli";
var VERSION = true ? "0.0.1" : "dev";
var DEFAULT_MC_VERSION = "26.2";
function paletteOf(volume) {
  const counts = /* @__PURE__ */ new Map();
  volume.eachCell((_x, _y, _z, idx) => {
    const state = volume.palette[idx];
    if (state !== AIR) counts.set(state, (counts.get(state) ?? 0) + 1);
  });
  return [...counts].map(([state, count]) => ({ state, count })).sort((a, b) => b.count - a.count || compareCodePoints(a.state, b.state));
}
var boxOf = (b) => b === null ? null : { min: [...b[0]], max: [...b[1]] };
var sizeOf = (b) => b === null ? [0, 0, 0] : [b.max[0] - b.min[0] + 1, b.max[1] - b.min[1] + 1, b.max[2] - b.min[2] + 1];
var fmtSize = (s) => s.join("×");
var fmtBox = (b) => b === null ? "none" : `${b.min.join(",")} to ${b.max.join(",")}`;
function fmtPalette(palette) {
  const w = Math.max(0, ...palette.map((p) => String(p.count).length));
  return palette.map((p) => `  ${String(p.count).padStart(w)} ${p.state}`);
}
function releaseOf(dataVersion) {
  for (const [release, dv] of Object.entries(DATA_VERSIONS)) if (dv === dataVersion) return release;
  return null;
}
var cacheRoot2 = (home) => join6(home, ".cache", "mcbuilder");
var usageError = (message) => new SkillCliError(message, 2);

// packages/mcbuilder/src/node/skill/formats.ts
import { extname as extname2 } from "node:path";
var FORMATS = ["schem", "litematic", "nbt", "mcstructure"];
var isFormat = (s) => FORMATS.includes(s);
function formatOfPath(path) {
  const ext = extname2(path).toLowerCase().slice(1);
  return isFormat(ext) ? ext : null;
}
async function encode(volume, format, options) {
  switch (format) {
    case "schem":
      return writeSchem(volume, {
        dataVersion: options.dataVersion,
        version: options.schemVersion
      });
    case "litematic":
      return writeLitematic(volume, {
        dataVersion: options.dataVersion,
        ...options.name === void 0 ? {} : { name: options.name },
        ...options.author === void 0 ? {} : { author: options.author }
      });
    case "nbt":
      return writeStructureNbt(volume, { dataVersion: options.dataVersion, air: options.air });
    case "mcstructure":
      return writeMcstructure(volume);
  }
}
async function decode(bytes, format) {
  const keepAir = true;
  switch (format) {
    case "schem": {
      const r = await readSchem(bytes, { keepAir });
      const m = r.meta;
      return {
        format,
        formatVersion: m.version,
        dataVersion: m.dataVersion,
        volume: r.volume,
        metadata: { offset: m.offset, size: [m.width, m.height, m.length] },
        blockEntities: r.volume.blockEntityCount + m.droppedBlockEntities,
        entities: r.volume.entities.length + m.droppedEntities,
        warnings: r.warnings
      };
    }
    case "litematic": {
      const r = await readLitematic(bytes, { keepAir });
      const m = r.meta;
      return {
        format,
        formatVersion: m.version,
        dataVersion: m.dataVersion,
        volume: r.volume,
        metadata: {
          name: m.name,
          author: m.author,
          description: m.description,
          regions: m.regionCount
        },
        blockEntities: r.volume.blockEntityCount + m.droppedBlockEntities,
        entities: r.volume.entities.length + m.droppedEntities,
        warnings: r.warnings
      };
    }
    case "nbt": {
      const r = await readStructureNbt(bytes, { keepAir });
      const m = r.meta;
      return {
        format,
        formatVersion: null,
        dataVersion: m.dataVersion,
        volume: r.volume,
        metadata: {},
        blockEntities: r.volume.blockEntityCount + m.droppedBlockEntities,
        entities: r.volume.entities.length + m.droppedEntities,
        warnings: r.warnings
      };
    }
    case "mcstructure": {
      const r = await readMcstructure(bytes, { keepAir });
      const m = r.meta;
      return {
        format,
        formatVersion: m.formatVersion,
        dataVersion: null,
        volume: r.volume,
        metadata: { size: m.size },
        blockEntities: r.volume.blockEntityCount + m.droppedBlockEntities,
        entities: r.volume.entities.length + m.droppedEntities,
        warnings: r.warnings
      };
    }
  }
}

// packages/mcbuilder/src/node/skill/registry.ts
import { readFile as readFile3 } from "node:fs/promises";
import { join as join7, resolve as resolve4 } from "node:path";
async function read(path, version) {
  let raw;
  try {
    raw = JSON.parse(await readFile3(path, "utf8"));
  } catch (e) {
    throw new SkillCliError(`could not read the block registry ${path}: ${e.message}`);
  }
  try {
    return Registry.fromData(raw, version);
  } catch (e) {
    throw new SkillCliError(`${path}: ${e.message}`);
  }
}
async function findRegistry(req) {
  if (req.file !== void 0) {
    const path = resolve4(req.cwd, req.file);
    if (!await exists2(path)) throw new SkillCliError(`--registry: no such file: ${path}`, 2);
    return {
      registry: await read(path, req.mcVersion),
      source: path,
      skipped: null,
      downloaded: false
    };
  }
  const root = cacheRoot2(req.home);
  const cached = join7(root, req.mcVersion, "minecraft-data.json");
  if (await exists2(cached)) {
    return {
      registry: await read(cached, req.mcVersion),
      source: cached,
      skipped: null,
      downloaded: false
    };
  }
  if (req.offline) {
    return {
      registry: null,
      source: null,
      skipped: `no block registry for ${req.mcVersion} at ${cached} and --offline is set`,
      downloaded: false
    };
  }
  try {
    const path = await fetchRegistry(
      req.mcVersion,
      root,
      req.get === void 0 ? {} : { get: req.get }
    );
    return {
      registry: await read(path, req.mcVersion),
      source: path,
      skipped: null,
      downloaded: true
    };
  } catch (e) {
    if (!(e instanceof AssetError)) throw e;
    return {
      registry: null,
      source: null,
      skipped: `the block registry for ${req.mcVersion} could not be downloaded (${e.message})`,
      downloaded: false
    };
  }
}

// packages/mcbuilder/src/node/skill/build.ts
var BUILD_USAGE = `Usage: ${PROG} build <recipe> --out <path> [options]

Run a recipe (an ES module that exports a Build as BUILD), validate its blocks
against the block registry of the Minecraft version, and write the schematic.

Options:
  --out <path>          file to write; repeat it to write several formats at once
  --format <f>          ${FORMATS.join(" | ")}
                        (default: the extension of --out; with --format an --out
                        that has no extension gets one)
  --mc-version <v>      Minecraft version for the registry and the DataVersion
                        (default ${DEFAULT_MC_VERSION}; known: ${Object.keys(DATA_VERSIONS).join(", ")})
  --data-version <n>    DataVersion to write, for a version the CLI does not know
  --registry <file>     block registry JSON to validate against, instead of the
                        cache in ~/.cache/mcbuilder/<v>/minecraft-data.json
  --offline             never download the registry; a build without a registry
                        is exported unvalidated, with a warning
  --allow <block>       accept this block name even if the registry lacks it
                        (modded blocks); repeatable
  --schem-version <n>   Sponge schematic version to write: 2 or 3 (default 3)
  --air <mode>          .nbt only: none | explicit | all (default none)
  --name <text>         .litematic only: the schematic's name
  --author <text>       .litematic only: the schematic's author
  --json                print the summary as one JSON document
  -h, --help            show this help

Exit codes: 0 written, 1 the recipe, validation or export failed (nothing is
written), 2 usage error.`;
var LEGACY = "'.schematic' is the legacy format from before Minecraft 1.13 and cannot be written; use .schem";
function resolveTargets(outs, format, cwd) {
  if (outs.length === 0) throw usageError("build: --out <path> is required");
  if (format !== void 0 && !isFormat(format)) {
    throw usageError(`--format must be one of ${FORMATS.join(", ")}, got '${format}'`);
  }
  if (format !== void 0 && outs.length > 1) {
    throw usageError(
      "--format cannot be combined with several --out; give each --out its extension instead"
    );
  }
  const targets = [];
  for (const out of outs) {
    if (out === "") throw usageError("--out must not be empty");
    const ext = extname3(out).toLowerCase();
    if (ext === ".schematic") throw usageError(LEGACY);
    const byExt = formatOfPath(out);
    let path = resolve5(cwd, out);
    let chosen;
    if (format !== void 0) {
      if (byExt !== null && byExt !== format) {
        throw usageError(`--out ${out} has the extension of ${byExt}, but --format is ${format}`);
      }
      chosen = format;
      if (ext === "") path = `${path}.${format}`;
    } else if (byExt !== null) {
      chosen = byExt;
    } else {
      throw usageError(
        `cannot tell the format of --out ${out}: use a .schem, .litematic, .nbt or .mcstructure extension, or pass --format`
      );
    }
    if (targets.some((t) => t.path === path)) throw usageError(`--out ${out} is given twice`);
    targets.push({ path, format: chosen });
  }
  return targets;
}
function locateInRecipe(thrown, recipe) {
  const stack = thrown instanceof Error ? thrown.stack ?? "" : "";
  for (const prefix of [pathToFileURL2(recipe).href, recipe]) {
    let from = 0;
    for (; ; ) {
      const at = stack.indexOf(prefix, from);
      if (at === -1) break;
      const m = /^(?:\?[^\s:)]*)?:(\d+)(?::(\d+))?/.exec(stack.slice(at + prefix.length));
      if (m) return `${basename3(recipe)}:${m[1]}${m[2] === void 0 ? "" : `:${m[2]}`}`;
      from = at + prefix.length;
    }
  }
  return null;
}
var fmtError = (e) => e.suggestions.length > 0 ? `${e.message} (did you mean ${e.suggestions.join(" or ")}?)` : e.message;
function printSummary(s, io) {
  const v = s.validation;
  io.out(`build: ${s.ok ? "OK" : "FAILED"}`);
  io.out(`recipe: ${s.recipe}`);
  io.out(`size: ${fmtSize(s.size)} (X×Y×Z)`);
  io.out(`bounds: ${fmtBox(s.bounds)}`);
  io.out(`blocks: ${s.blocks}`);
  io.out(`block states: ${s.blockStates}`);
  io.out(
    `minecraft: ${s.mcVersion}${s.dataVersion === null ? "" : ` (DataVersion ${s.dataVersion})`}`
  );
  io.out(
    v.registry === null ? "validation: skipped" : `validation: ${v.registry} registry, ${v.errors.length} ${v.errors.length === 1 ? "error" : "errors"}`
  );
  io.out("palette:");
  for (const line2 of fmtPalette(s.palette)) io.out(line2);
  if (v.errors.length > 0) {
    io.out("errors:");
    for (const e of v.errors) io.out(`  - ${fmtError(e)}`);
  }
  if (s.warnings.length > 0) {
    io.out("warnings:");
    for (const w of s.warnings) io.out(`  - ${w}`);
  }
  if (s.outputs.length > 0) {
    io.out("wrote:");
    for (const o of s.outputs) io.out(`  ${o.path} (${o.format}, ${o.bytes} bytes)`);
  } else {
    io.out("nothing was written");
  }
}
function parseDataVersion(value) {
  if (value === void 0) return void 0;
  if (!/^\d+$/.test(value))
    throw usageError(`--data-version must be a whole number, got '${value}'`);
  return Number(value);
}
async function resolveDataVersionFor(mcVersion, override, home) {
  if (override !== void 0) return override;
  const versionJson = join8(cacheRoot2(home), mcVersion, "version.json");
  if (await exists2(versionJson)) {
    try {
      const wv = JSON.parse(await readFile4(versionJson, "utf8")).world_version;
      if (typeof wv === "number" && Number.isInteger(wv)) return wv;
    } catch {
    }
  }
  const known = Object.hasOwn(DATA_VERSIONS, mcVersion) ? DATA_VERSIONS[mcVersion] : void 0;
  if (known === void 0) {
    throw new SkillCliError(
      `unknown DataVersion for Minecraft '${mcVersion}' (known versions: ${Object.keys(DATA_VERSIONS).join(", ")}); pass --data-version <n>`,
      2
    );
  }
  return known;
}
async function cmdBuild(args, io, deps = {}) {
  const { values, positionals } = parseArgs2({
    args,
    allowPositionals: true,
    options: {
      out: { type: "string", multiple: true },
      format: { type: "string" },
      "mc-version": { type: "string" },
      "data-version": { type: "string" },
      registry: { type: "string" },
      offline: { type: "boolean" },
      allow: { type: "string", multiple: true },
      "schem-version": { type: "string" },
      air: { type: "string" },
      name: { type: "string" },
      author: { type: "string" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" }
    }
  });
  if (values.help) {
    for (const line2 of BUILD_USAGE.split("\n")) io.out(line2);
    return 0;
  }
  if (positionals.length !== 1) {
    throw usageError(`build takes exactly one recipe, got ${positionals.length}`);
  }
  const targets = resolveTargets(values.out ?? [], values.format, io.cwd);
  const schemVersion = Number(values["schem-version"] ?? "3");
  if (schemVersion !== 2 && schemVersion !== 3) {
    throw usageError(`--schem-version must be 2 or 3, got '${values["schem-version"]}'`);
  }
  const air = values.air ?? "none";
  if (!["none", "explicit", "all"].includes(air)) {
    throw usageError(`--air must be none, explicit or all, got '${air}'`);
  }
  const mcVersion = values["mc-version"] ?? DEFAULT_MC_VERSION;
  if (mcVersion === "") throw usageError("--mc-version must not be empty");
  const dataVersionOverride = parseDataVersion(values["data-version"]);
  const json = values.json === true;
  const recipe = resolve5(io.cwd, positionals[0]);
  try {
    const summary2 = await runBuild({
      recipe,
      targets,
      mcVersion,
      dataVersionOverride,
      registryFile: values.registry,
      offline: values.offline === true,
      allow: values.allow ?? [],
      schemVersion,
      air,
      name: values.name,
      author: values.author,
      io,
      get: deps.get
    });
    if (json) io.out(JSON.stringify(summary2, null, 2));
    else printSummary(summary2, io);
    return summary2.ok ? 0 : 1;
  } catch (e) {
    if (json && e instanceof SkillCliError && e.exitCode === 1) {
      io.out(JSON.stringify({ ok: false, recipe, error: e.message }, null, 2));
      return 1;
    }
    throw e;
  }
}
async function runBuild(req) {
  let build;
  try {
    build = await loadScript(req.recipe);
  } catch (e) {
    if (!(e instanceof ScriptError)) throw e;
    const where = locateInRecipe(e.thrown, req.recipe);
    throw new SkillCliError(where === null ? e.message : `${e.message} (at ${where})`);
  }
  const volume = build.grid.volume;
  const palette = paletteOf(volume);
  const blocks = palette.reduce((n2, p) => n2 + p.count, 0);
  if (blocks === 0) {
    throw new SkillCliError(
      `${basename3(req.recipe)} placed no blocks: place them inside BUILD.scope(() => { ... })`
    );
  }
  const bounds = boxOf(volume.bounds());
  const warnings = scanDeterminism(await readFile4(req.recipe, "utf8"), basename3(req.recipe));
  const found = await findRegistry({
    mcVersion: req.mcVersion,
    offline: req.offline,
    cwd: req.io.cwd,
    home: req.io.home,
    ...req.registryFile === void 0 ? {} : { file: req.registryFile },
    ...req.get === void 0 ? {} : { get: req.get }
  });
  let errors = [];
  let registryWarnings = [];
  if (found.registry === null) {
    warnings.push(
      `validation skipped: ${found.skipped}; block names and block states were not checked`
    );
  } else {
    const result = found.registry.validate(
      palette.map((p) => p.state),
      req.allow
    );
    errors = result.errors.map((e) => ({
      ...e,
      message: e.message.replace(
        "add it to `allowlist` in mcbuild.toml",
        `pass --allow ${e.block.replace(/[[{].*$/s, "")}`
      )
    }));
    registryWarnings = result.warnings;
    warnings.push(...registryWarnings.map((w) => w.message));
  }
  const summary2 = {
    ok: errors.length === 0,
    recipe: req.recipe,
    size: sizeOf(bounds),
    bounds,
    blocks,
    blockStates: palette.length,
    palette,
    mcVersion: req.mcVersion,
    dataVersion: null,
    validation: {
      registry: found.registry?.version ?? null,
      source: found.source,
      skipped: found.skipped,
      errors,
      warnings: registryWarnings
    },
    warnings,
    outputs: []
  };
  if (!summary2.ok) return summary2;
  const dataVersion = await resolveDataVersionFor(
    req.mcVersion,
    req.dataVersionOverride,
    req.io.home
  );
  summary2.dataVersion = dataVersion;
  const encoded = [];
  for (const target of req.targets) {
    try {
      const result = await encode(volume, target.format, {
        dataVersion,
        schemVersion: req.schemVersion,
        air: req.air,
        // A litematic shows its name in Litematica's list: default to the recipe's file name.
        name: req.name ?? basename3(req.recipe, extname3(req.recipe)),
        ...req.author === void 0 ? {} : { author: req.author }
      });
      encoded.push({ target, result });
    } catch (e) {
      throw new SkillCliError(
        `could not write ${target.format}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
  for (const { target, result } of encoded) {
    await mkdir3(dirname3(target.path), { recursive: true });
    await writeFile3(target.path, result.bytes);
    summary2.outputs.push({
      path: target.path,
      format: target.format,
      bytes: result.bytes.byteLength,
      warnings: result.warnings
    });
    warnings.push(...result.warnings.map((w) => `${basename3(target.path)}: ${w}`));
  }
  return summary2;
}

// packages/mcbuilder/src/node/skill/inspect.ts
import { readFile as readFile5 } from "node:fs/promises";
import { extname as extname4, resolve as resolve6 } from "node:path";
import { parseArgs as parseArgs3 } from "node:util";
var INSPECT_USAGE = `Usage: ${PROG} inspect <schematic> [--json]

Print what a .schem, .litematic, .nbt or .mcstructure file holds: format,
DataVersion, size, block count, palette, block entities, entities and anything
the reader could not carry.

Options:
  --json        print the report as one JSON document
  -h, --help    show this help`;
var fmtValue = (v) => Array.isArray(v) ? v.join(",") : v === null || v === void 0 || v === "" ? "none" : String(v);
async function cmdInspect(args, io) {
  const { values, positionals } = parseArgs3({
    args,
    allowPositionals: true,
    options: { json: { type: "boolean" }, help: { type: "boolean", short: "h" } }
  });
  if (values.help) {
    for (const line2 of INSPECT_USAGE.split("\n")) io.out(line2);
    return 0;
  }
  if (positionals.length !== 1) {
    throw usageError(`inspect takes exactly one file, got ${positionals.length}`);
  }
  const file = resolve6(io.cwd, positionals[0]);
  if (extname4(file).toLowerCase() === ".schematic") throw usageError(LEGACY_SCHEMATIC_MESSAGE);
  const format = formatOfPath(file);
  if (format === null) {
    throw usageError(
      `cannot inspect '${positionals[0]}': expected a .schem, .litematic, .nbt or .mcstructure file`
    );
  }
  if (!await exists2(file)) throw new SkillCliError(`no such file: ${file}`);
  let bytes;
  try {
    bytes = new Uint8Array(await readFile5(file));
  } catch (e) {
    throw new SkillCliError(`could not read ${file}: ${e.message}`);
  }
  let decoded;
  try {
    decoded = await decode(bytes, format);
  } catch (e) {
    throw new SkillCliError(`${file} is not a readable ${format} file: ${e.message}`);
  }
  const palette = paletteOf(decoded.volume);
  const report = {
    file,
    format,
    formatVersion: decoded.formatVersion,
    dataVersion: decoded.dataVersion,
    mcVersion: decoded.dataVersion === null ? null : releaseOf(decoded.dataVersion),
    size: sizeOf(boxOf(decoded.volume.placedBounds())),
    bounds: boxOf(decoded.volume.bounds()),
    blocks: palette.reduce((n2, p) => n2 + p.count, 0),
    blockStates: palette.length,
    blockEntities: decoded.blockEntities,
    entities: decoded.entities,
    metadata: decoded.metadata,
    palette,
    warnings: decoded.warnings
  };
  if (values.json) {
    io.out(JSON.stringify(report, null, 2));
    return 0;
  }
  io.out(`file: ${report.file}`);
  io.out(
    `format: ${report.format}${report.formatVersion === null ? "" : ` (version ${report.formatVersion})`}`
  );
  io.out(
    report.dataVersion === null ? "minecraft: Bedrock (no DataVersion)" : `minecraft: DataVersion ${report.dataVersion}${report.mcVersion === null ? "" : ` (${report.mcVersion})`}`
  );
  io.out(`size: ${fmtSize(report.size)} (X×Y×Z)`);
  io.out(`bounds: ${fmtBox(report.bounds)}`);
  io.out(`blocks: ${report.blocks}`);
  io.out(`block states: ${report.blockStates}`);
  io.out(`block entities: ${report.blockEntities}`);
  io.out(`entities: ${report.entities}`);
  const meta = Object.entries(report.metadata);
  if (meta.length > 0) {
    io.out("metadata:");
    for (const [k, v] of meta) io.out(`  ${k}: ${fmtValue(v)}`);
  }
  io.out("palette:");
  for (const line2 of fmtPalette(report.palette)) io.out(line2);
  if (report.warnings.length > 0) {
    io.out("warnings:");
    for (const w of report.warnings) io.out(`  - ${w}`);
  }
  return 0;
}

// packages/mcbuilder/src/node/skill/preview.ts
import { spawn } from "node:child_process";
import { createHash as createHash2 } from "node:crypto";
import { existsSync as existsSync2, statSync } from "node:fs";
import { mkdir as mkdir4, readFile as readFile6, rename, stat as stat5, writeFile as writeFile4 } from "node:fs/promises";
import { createServer } from "node:http";
import { basename as basename4, dirname as dirname4, extname as extname5, join as join9, resolve as resolve7, sep as sep3 } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs as parseArgs4 } from "node:util";
var DEFAULT_PORT = 4173;
var DEFAULT_HOST = "127.0.0.1";
var PUBLISHED_WEB = "https://luki.is-a.dev/voxwright/";
var PORT_TRIES = 50;
var SCHEMATIC_EXTENSIONS = [".schem", ".litematic", ".nbt", ".mcstructure"];
var PREVIEW_USAGE = `Usage: voxwright-cli preview <schematic> [options]

Serve the web viewer and editor on this machine with <schematic> opened in it
(.schem, .litematic, .nbt or .mcstructure). The file is read again on every page
load, so rebuild and refresh the page to see the new build. Runs until Ctrl+C.

Options:
  --port <n>          port to listen on (default ${DEFAULT_PORT}; when it is busy the next free
                      one is used; an explicit --port that is busy is an error)
  --host <h>          address to listen on (default ${DEFAULT_HOST})
  --no-open           do not open the page in the default browser
  --web <dir|url>     web app to serve: a built apps/web directory or an http(s) URL
                      (default: $VOXWRIGHT_WEB, else apps/web/build of this checkout,
                      else ${PUBLISHED_WEB} through a local caching proxy)
  -h, --help          show this help`;
async function cmdPreview(args, io) {
  let parsed;
  try {
    parsed = parsePreviewArgs(args);
  } catch (err2) {
    if (err2 instanceof SkillCliError) throw err2;
    throw new SkillCliError(
      `${err2 instanceof Error ? err2.message : String(err2)}
${PREVIEW_USAGE}`,
      2
    );
  }
  if (parsed.help) {
    for (const line2 of PREVIEW_USAGE.split("\n")) io.out(line2);
    return 0;
  }
  const preview = await startPreview({
    schematic: parsed.schematic,
    cwd: io.cwd,
    home: io.home,
    web: parsed.web ?? (io.env.VOXWRIGHT_WEB?.trim() || void 0),
    port: parsed.port,
    host: parsed.host
  });
  for (const note of preview.notes) io.err(`warning: ${note}`);
  io.out(`Preview URL: ${preview.url}`);
  io.out(`Web app: ${describeSource(preview.source)}. Press Ctrl+C to stop.`);
  if (parsed.open) openBrowser(preview.url, (msg) => io.err(`warning: ${msg}`));
  await new Promise((done) => {
    const stop = () => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      done();
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  });
  await preview.close();
  return 0;
}
function parsePreviewArgs(args) {
  const { values, positionals } = parseArgs4({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      port: { type: "string" },
      host: { type: "string" },
      "no-open": { type: "boolean" },
      web: { type: "string" },
      help: { type: "boolean", short: "h" }
    }
  });
  if (values.help)
    return {
      help: true,
      schematic: "",
      port: void 0,
      host: void 0,
      web: void 0,
      open: false
    };
  if (positionals.length !== 1)
    throw new SkillCliError(
      `preview takes exactly one schematic, got ${positionals.length}
${PREVIEW_USAGE}`,
      2
    );
  let port;
  if (values.port !== void 0) {
    port = Number(values.port);
    if (!/^\d+$/.test(values.port) || port > 65535)
      throw new SkillCliError(
        `--port must be a whole number from 0 to 65535, got '${values.port}'`,
        2
      );
  }
  if (values.host !== void 0 && values.host.trim() === "")
    throw new SkillCliError("--host must not be empty", 2);
  return {
    help: false,
    schematic: positionals[0],
    port,
    host: values.host,
    web: values.web,
    open: !values["no-open"]
  };
}
function describeSource(source) {
  if (source.kind === "dir")
    return source.why === "local-build" ? `local build at ${source.dir}` : `directory ${source.dir}`;
  return `${source.upstream} through a local proxy (cached in ${source.cacheDir})`;
}
async function startPreview(options) {
  const file = resolve7(options.cwd, options.schematic);
  const ext = extname5(file).toLowerCase();
  if (ext === ".schematic")
    throw new SkillCliError(
      "'.schematic' is the legacy format from before Minecraft 1.13 and is not supported; re-save the build as .schem",
      2
    );
  if (!SCHEMATIC_EXTENSIONS.includes(ext))
    throw new SkillCliError(
      `cannot preview '${basename4(file)}': expected a .schem, .litematic, .nbt or .mcstructure file`,
      2
    );
  let st;
  try {
    st = statSync(file);
  } catch {
    throw new SkillCliError(`no such file: ${file}`);
  }
  if (!st.isFile()) throw new SkillCliError(`not a file: ${file}`);
  const notes = [];
  const timeoutMs = options.upstreamTimeoutMs ?? 15e3;
  const source = await chooseSource(options, notes, timeoutMs);
  const base = source.kind === "dir" ? "/" : new URL(source.upstream).pathname;
  const name = basename4(file);
  const schematicPath = `${base}__preview/${name}`;
  const handler = async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" });
      res.end("Only GET and HEAD are supported.\n");
      return;
    }
    const raw = (req.url ?? "/").split("?")[0];
    let path;
    try {
      path = decodeURIComponent(raw);
    } catch {
      return send(req, res, 400, "text/plain; charset=utf-8", "Bad request.\n");
    }
    if (path === schematicPath) return serveSchematic(req, res, file);
    if (source.kind === "dir") return serveStatic(req, res, source.dir, path, raw);
    return serveProxy(req, res, source, raw, timeoutMs);
  };
  const server = createServer((req, res) => {
    handler(req, res).catch((err2) => {
      if (!res.headersSent)
        send(req, res, 500, "text/plain; charset=utf-8", `Internal error: ${String(err2)}
`);
      else res.destroy();
    });
  });
  const host = options.host ?? DEFAULT_HOST;
  let port;
  if (options.port !== void 0) {
    try {
      port = await listen(server, options.port, host);
    } catch (err2) {
      throw listenError(err2, options.port, host, true);
    }
  } else {
    port = -1;
    for (let p = DEFAULT_PORT; p < DEFAULT_PORT + PORT_TRIES && p <= 65535; p++) {
      try {
        port = await listen(server, p, host);
        break;
      } catch (err2) {
        if (err2.code !== "EADDRINUSE")
          throw listenError(err2, p, host, false);
      }
    }
    if (port === -1)
      throw new SkillCliError(
        `ports ${DEFAULT_PORT} to ${DEFAULT_PORT + PORT_TRIES - 1} on ${host} are all in use; pass a free --port`
      );
    if (port !== DEFAULT_PORT) notes.push(`port ${DEFAULT_PORT} is in use, using ${port}`);
  }
  const shownHost = host === "0.0.0.0" ? "127.0.0.1" : host === "::" ? "[::1]" : host.includes(":") ? `[${host}]` : host;
  const url = `http://${shownHost}:${port}${base}?open=${openParam(name)}`;
  return {
    url,
    host,
    port,
    source,
    notes,
    close: () => new Promise((done) => {
      server.close(() => done());
      server.closeAllConnections();
    })
  };
}
function openParam(name) {
  return encodeURIComponent(`__preview/${encodeURIComponent(name)}`).replaceAll("%2F", "/");
}
function listen(server, port, host) {
  return new Promise((ok, fail) => {
    const onError = (err2) => {
      server.off("listening", onListening);
      fail(err2);
    };
    const onListening = () => {
      server.off("error", onError);
      ok(server.address().port);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}
function listenError(err2, port, host, explicit) {
  const code = err2.code;
  if (code === "EADDRINUSE" && explicit)
    return new SkillCliError(
      `port ${port} on ${host} is already in use; pass another --port or leave it out to pick a free one`
    );
  if (code === "EADDRNOTAVAIL" || code === "ENOTFOUND")
    return new SkillCliError(`cannot listen on host '${host}': ${code}`, 2);
  return new SkillCliError(
    `cannot listen on ${host}:${port}: ${err2 instanceof Error ? err2.message : String(err2)}`
  );
}
async function chooseSource(options, notes, timeoutMs) {
  const cacheRoot3 = join9(options.home, ".cache", "voxwright", "web");
  if (options.web !== void 0) {
    if (/^https?:\/\//i.test(options.web)) {
      const upstream2 = await resolveUpstream(options.web, cacheRoot3, notes, timeoutMs);
      return { kind: "proxy", upstream: upstream2, cacheDir: cacheRoot3, why: "explicit" };
    }
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(options.web))
      throw new SkillCliError(
        `--web must be a directory or an http(s) URL, got '${options.web}'`,
        2
      );
    const dir = resolve7(options.cwd, options.web);
    if (!existsSync2(join9(dir, "index.html")))
      throw new SkillCliError(
        `--web ${dir} has no index.html; build the web app first (pnpm --filter @voxwright/web build)`,
        2
      );
    return { kind: "dir", dir, why: "explicit" };
  }
  const local = findLocalWebBuild(options.searchFrom ?? dirname4(fileURLToPath(import.meta.url)));
  if (local !== null) return { kind: "dir", dir: local, why: "local-build" };
  const upstream = await resolveUpstream(
    options.published ?? PUBLISHED_WEB,
    cacheRoot3,
    notes,
    timeoutMs
  );
  return { kind: "proxy", upstream, cacheDir: cacheRoot3, why: "published" };
}
function findLocalWebBuild(from) {
  let dir = resolve7(from);
  for (; ; ) {
    if (existsSync2(join9(dir, "apps", "web"))) {
      const build = join9(dir, "apps", "web", "build");
      return existsSync2(join9(build, "index.html")) ? build : null;
    }
    const up = dirname4(dir);
    if (up === dir) return null;
    dir = up;
  }
}
function asDirectoryUrl(u) {
  const copy = new URL(u.href);
  copy.search = "";
  copy.hash = "";
  if (!copy.pathname.endsWith("/")) copy.pathname = copy.pathname.replace(/[^/]*$/, "");
  return copy.href;
}
async function resolveUpstream(given, cacheRoot3, notes, timeoutMs) {
  let start;
  try {
    start = new URL(given);
  } catch {
    throw new SkillCliError(`--web: not a valid URL: '${given}'`, 2);
  }
  if (!start.pathname.endsWith("/")) start.pathname = `${start.pathname}/`;
  start.search = "";
  start.hash = "";
  const aliasesFile = join9(cacheRoot3, "aliases.json");
  let aliases = {};
  try {
    aliases = JSON.parse(await readFile6(aliasesFile, "utf8"));
  } catch {
  }
  try {
    const res = await fetch(start, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "voxwright-cli preview" }
    });
    await res.body?.cancel();
    const final = asDirectoryUrl(new URL(res.url || start.href));
    if (final !== start.href && aliases[start.href] !== final) {
      aliases[start.href] = final;
      await writeAtomic(aliasesFile, JSON.stringify(aliases, null, 2));
    }
    if (!res.ok) notes.push(`${final} answered HTTP ${res.status}`);
    return final;
  } catch (err2) {
    const known = aliases[start.href] ?? start.href;
    notes.push(
      `${start.href} could not be reached (${errText(err2)}); serving the cached copy of ${known} where there is one`
    );
    return known;
  }
}
var CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".zip": "application/zip"
};
var contentTypeFor = (path) => CONTENT_TYPES[extname5(path).toLowerCase()] ?? "application/octet-stream";
function send(req, res, status, type, body, headers = {}) {
  const bytes = typeof body === "string" ? Buffer.from(body) : body;
  res.writeHead(status, {
    "content-type": type,
    "content-length": String(bytes.byteLength),
    "x-content-type-options": "nosniff",
    ...headers
  });
  res.end(req.method === "HEAD" ? void 0 : bytes);
}
var notFound = (req, res) => send(req, res, 404, "text/plain; charset=utf-8", "Not found.\n", { "cache-control": "no-store" });
async function serveSchematic(req, res, file) {
  let bytes;
  try {
    bytes = await readFile6(file);
  } catch {
    return notFound(req, res);
  }
  send(req, res, 200, "application/octet-stream", bytes, { "cache-control": "no-store" });
}
async function serveStatic(req, res, root, path, rawPath) {
  if (path.includes("\0") || path.includes("\\")) return notFound(req, res);
  const segments = path.split("/").filter((s) => s !== "");
  if (segments.some((s) => s === "." || s === "..")) return notFound(req, res);
  let file = join9(root, ...segments);
  if (file !== root && !file.startsWith(root + sep3)) return notFound(req, res);
  let st = await stat5(file).catch(() => null);
  if (st?.isDirectory()) {
    if (!path.endsWith("/"))
      return send(req, res, 301, "text/plain; charset=utf-8", "", { location: `${rawPath}/` });
    file = join9(file, "index.html");
    st = await stat5(file).catch(() => null);
  }
  if (!st?.isFile()) {
    if (extname5(path) !== "") return notFound(req, res);
    file = join9(root, "200.html");
    st = await stat5(file).catch(() => null);
    if (!st?.isFile()) return notFound(req, res);
  }
  const bytes = await readFile6(file);
  const immutable = path.includes("/_app/immutable/");
  send(req, res, 200, contentTypeFor(file), bytes, {
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache"
  });
}
function cachePaths(cacheDir, upstreamUrl) {
  const u = new URL(upstreamUrl);
  const key2 = createHash2("sha256").update(`${u.origin}${u.pathname}`).digest("hex");
  const host = u.host.replace(/[^a-z0-9.-]/gi, "_");
  return {
    body: join9(cacheDir, host, `${key2}.body`),
    meta: join9(cacheDir, host, `${key2}.json`)
  };
}
async function readCache(cacheDir, upstreamUrl) {
  const p = cachePaths(cacheDir, upstreamUrl);
  try {
    const meta = JSON.parse(await readFile6(p.meta, "utf8"));
    const body = await readFile6(p.body);
    return { meta, body };
  } catch {
    return null;
  }
}
async function writeCache(cacheDir, upstreamUrl, contentType, body) {
  const p = cachePaths(cacheDir, upstreamUrl);
  const meta = { url: upstreamUrl, status: 200, contentType, savedAt: Date.now() };
  await writeAtomic(p.body, body);
  await writeAtomic(p.meta, JSON.stringify(meta));
}
async function writeAtomic(path, data) {
  await mkdir4(dirname4(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile4(tmp, data);
  await rename(tmp, path);
}
async function serveProxy(req, res, source, rawPath, timeoutMs) {
  const upstream = new URL(source.upstream);
  const base = upstream.pathname;
  if (rawPath === "/" && base !== "/")
    return send(req, res, 302, "text/plain; charset=utf-8", "", { location: base });
  if (rawPath === base.slice(0, -1))
    return send(req, res, 301, "text/plain; charset=utf-8", "", { location: base });
  if (!rawPath.startsWith(base) || rawPath.split("/").some((s) => s === ".." || s === "."))
    return notFound(req, res);
  const targetUrl = new URL(rawPath, upstream.origin);
  if (!targetUrl.pathname.startsWith(base)) return notFound(req, res);
  const target = targetUrl.href;
  const immutable = rawPath.includes("/_app/immutable/");
  const fromCache = async () => {
    const hit = await readCache(source.cacheDir, target);
    if (hit === null) return false;
    send(req, res, 200, hit.meta.contentType, hit.body, {
      "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
      "x-voxwright-cache": "hit"
    });
    return true;
  };
  if (immutable && await fromCache()) return;
  let upstreamRes;
  try {
    upstreamRes = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "voxwright-cli preview", accept: req.headers.accept ?? "*/*" }
    });
  } catch (err2) {
    if (await fromCache()) return;
    return send(
      req,
      res,
      502,
      "text/plain; charset=utf-8",
      `The web app at ${target} could not be reached (${errText(err2)}) and no cached copy exists.
`,
      { "cache-control": "no-store" }
    );
  }
  const finalUrl = upstreamRes.url ? new URL(upstreamRes.url) : new URL(target);
  if (finalUrl.href !== target) {
    if (finalUrl.origin === upstream.origin && finalUrl.pathname.startsWith(base)) {
      await upstreamRes.body?.cancel();
      return send(req, res, 302, "text/plain; charset=utf-8", "", {
        location: `${finalUrl.pathname}${finalUrl.search}`
      });
    }
  }
  let body;
  try {
    body = new Uint8Array(await upstreamRes.arrayBuffer());
  } catch (err2) {
    if (await fromCache()) return;
    return send(
      req,
      res,
      502,
      "text/plain; charset=utf-8",
      `Reading ${target} failed (${errText(err2)}).
`,
      {
        "cache-control": "no-store"
      }
    );
  }
  if (upstreamRes.status >= 500 && await fromCache()) return;
  const contentType = upstreamRes.headers.get("content-type") ?? contentTypeFor(finalUrl.pathname);
  if (upstreamRes.status === 200) {
    await writeCache(source.cacheDir, target, contentType, body).catch(() => {
    });
  }
  const headers = {
    "cache-control": upstreamRes.status === 200 && immutable ? "public, max-age=31536000, immutable" : "no-cache"
  };
  const lastModified = upstreamRes.headers.get("last-modified");
  if (lastModified) headers["last-modified"] = lastModified;
  send(req, res, upstreamRes.status, contentType, body, headers);
}
var errText = (err2) => {
  if (err2 instanceof Error) {
    const cause = err2.cause;
    if (cause instanceof Error) return cause.message;
    return err2.message;
  }
  return String(err2);
};
function openBrowser(url, warn) {
  const [cmd, args] = process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", '""', `"${url}"`]] : ["xdg-open", [url]];
  const failed = (why) => warn(`could not open a browser (${why}); open the Preview URL above yourself`);
  try {
    const child2 = spawn(cmd, args, {
      stdio: "ignore",
      detached: true,
      // `start "" "<url>"`: the quotes must reach cmd as written, or `&` in the URL splits the command.
      windowsVerbatimArguments: process.platform === "win32"
    });
    child2.on("error", (err2) => failed(`${cmd}: ${err2.message}`));
    child2.on("exit", (code) => {
      if (code !== 0 && code !== null) failed(`${cmd} exited with code ${code}`);
    });
    child2.unref();
  } catch (err2) {
    failed(errText(err2));
  }
}

// packages/mcbuilder/src/node/skill/main.ts
var BUNDLED = true;
var USAGE2 = `Usage: ${PROG} <command> [options]

Commands:
  build <recipe> --out <path>   run a recipe, validate it and write a schematic
  inspect <schematic>           print what a schematic file holds
  preview <schematic>           serve the 3D viewer and editor with the file open

  ${PROG} <command> --help      options of one of the three commands above
  ${PROG} --version

Run directories, PNG previews and import:
  init      write a starter recipe
  check     validate a recipe without writing anything
  run       write a numbered run directory: report.json, the .nbt, and with
            --preview PNG views, with --guide a build guide
  import    turn a schematic into a recipe
  diff      compare two run directories
  assets    download the block registry and the client assets the PNG views need

${RUN_SYNTAX.split("\n").map((l) => l.startsWith(" ") ? `    ${l.trimStart()}` : `  ${PROG} ${l}`).join("\n")}

A recipe is an ES module (.ts, .mts, .mjs, .js) that exports a Build:

  import { Build } from "voxwright";
  export const BUILD = new Build({ seed: 1 });
  BUILD.scope(() => {
    BUILD.box([0, 0, 0], [4, 0, 4], "minecraft:stone_bricks");
  });

Formats: .schem, .litematic, .nbt, .mcstructure.
Exit codes: 0 success, 1 failure, 2 usage error.`;
var MIN_NODE = "22.18";
function nodeProblem(recipe) {
  const found = `found ${process.version}`;
  if (typeof nodeModule.registerHooks !== "function") {
    return `Node ${MIN_NODE} or later is required (${found})`;
  }
  const ts = recipe !== void 0 && [".ts", ".mts", ".cts"].includes(extname6(recipe).toLowerCase());
  if (ts && !process.features.typescript) {
    return `TypeScript recipes need Node ${MIN_NODE} or later (${found}); upgrade Node or write the recipe as .mjs`;
  }
  return null;
}
var ENGINE_SOURCE = /\/packages\/(?:mcbuilder|core)\/src\/index\.ts(?:\?.*)?$/;
var aliased = false;
function installAlias() {
  if (aliased) return;
  aliased = true;
  const names = new Set(
    BUNDLED ? ["voxwright", "@voxwright/mcbuilder", "@voxwright/core"] : ["voxwright", "@voxwright/mcbuilder"]
  );
  const self = import.meta.url;
  nodeModule.registerHooks({
    resolve(specifier, context, nextResolve) {
      if (names.has(specifier)) return { url: self, shortCircuit: true };
      const resolved = nextResolve(specifier, context);
      if (BUNDLED && ENGINE_SOURCE.test(resolved.url)) return { url: self, shortCircuit: true };
      return resolved;
    }
  });
}
async function runSkillCli(argv, io = {}, deps = {}) {
  const full = {
    out: io.out ?? ((l) => console.log(l)),
    err: io.err ?? ((l) => console.error(l)),
    cwd: io.cwd ?? process.cwd(),
    home: io.home ?? homedir2(),
    env: io.env ?? process.env
  };
  const [command, ...rest] = argv;
  const usageOf = {
    build: BUILD_USAGE,
    inspect: INSPECT_USAGE,
    preview: PREVIEW_USAGE
  };
  try {
    if (command !== void 0 && RUN_COMMANDS.includes(command)) {
      return await runCli(argv, full, deps);
    }
    switch (command) {
      case "build":
        return await cmdBuild(rest, full, deps);
      case "inspect":
        return await cmdInspect(rest, full);
      case "preview":
        return await cmdPreview(rest, full);
      case "-h":
      case "--help":
      case "help":
        for (const line2 of USAGE2.split("\n")) full.out(line2);
        return 0;
      case "-V":
      case "--version":
        full.out(`${PROG} ${VERSION}`);
        return 0;
      case void 0:
        for (const line2 of USAGE2.split("\n")) full.err(line2);
        return 2;
      default:
        full.err(`${PROG}: unknown command '${command}'`);
        for (const line2 of USAGE2.split("\n")) full.err(line2);
        return 2;
    }
  } catch (e) {
    if (e instanceof SkillCliError) {
      full.err(`${PROG}: ${e.message}`);
      if (e.exitCode === 2 && command !== void 0 && usageOf[command] !== void 0) {
        full.err(`Run '${PROG} ${command} --help' for the options.`);
      }
      return e.exitCode;
    }
    const code = e?.code;
    if (typeof code === "string" && code.startsWith("ERR_PARSE_ARGS_")) {
      full.err(`${PROG}: ${e.message.split(". ")[0]?.replace(/\.$/, "")}`);
      if (command !== void 0 && usageOf[command] !== void 0) {
        full.err(`Run '${PROG} ${command} --help' for the options.`);
      }
      return 2;
    }
    if (e instanceof McbuilderError) {
      full.err(`${PROG}: ${e.message}`);
      return 1;
    }
    throw e;
  }
}
function isEntryPoint() {
  const script = process.argv[1];
  if (script === void 0) return false;
  try {
    return realpathSync(script) === realpathSync(fileURLToPath2(import.meta.url));
  } catch {
    return false;
  }
}
function main(argv = process.argv.slice(2)) {
  const problem = nodeProblem(
    ["build", "check", "run"].includes(argv[0] ?? "") ? argv.find((a, i2) => i2 > 0 && !a.startsWith("-")) : void 0
  );
  if (problem !== null) {
    console.error(`${PROG}: ${problem}`);
    process.exitCode = 1;
  } else {
    installAlias();
    runSkillCli(argv).then(
      (code) => {
        process.exitCode = code;
      },
      (e) => {
        console.error(e);
        process.exitCode = 1;
      }
    );
  }
}
if (isEntryPoint()) main();
export {
  AIR,
  BlockStringError,
  Build,
  BuildError,
  CodecError,
  CommandBuilder,
  ConfigError,
  DATA_VERSIONS,
  DEFAULT_HISTORY_BYTES,
  DiffError,
  DirtyTracker,
  EditError,
  Editor,
  ExportError,
  Geometry,
  GridBoundsError,
  History,
  LEGACY_SCHEMATIC_MESSAGE,
  MAX_EXTENT,
  McbuilderError,
  NbtError,
  ROTATIONS,
  Registry,
  RegistryError,
  Rng,
  RotationError,
  Stroke,
  TagId,
  UNSET,
  USAGE2 as USAGE,
  Volume,
  VolumeError,
  VoxelGrid,
  applyCommand,
  bedrockToJava,
  blockEntityKey,
  blockIdOf,
  blockProperties,
  boxCellCount,
  boxContains,
  boxSize,
  buildGuide,
  buildLitematic,
  buildMcstructure,
  buildReport,
  buildSchem,
  buildStructureNbt,
  byte2 as byte,
  byteArray,
  canonicalize,
  carriedOffset,
  cleanProperties,
  clipboardCellCount,
  cloneNbt,
  cloneVolume,
  commandBytes,
  commandCellCount,
  compareCodePoints,
  compound,
  constName,
  copySelection,
  decodeMutf8,
  isEmpty as diffIsEmpty,
  total as diffTotal,
  diffVoxelMaps,
  dirtySectionKeys,
  double,
  drawBox,
  drawLine,
  drawRectangle,
  eachCellInBox,
  eachPosInBox,
  encodeMutf8,
  entityPosition,
  eraseBlock,
  eraseCells,
  expandUser,
  fillSelection,
  float,
  forEachChange,
  formatDiff,
  getCloseMatches,
  gunzip,
  gzip,
  int2 as int,
  intArray,
  isEmptyBlock,
  isEmptyCommand,
  isGzip,
  isPySpace,
  itemCounts,
  javaToBedrock,
  join as joinBlockString,
  linePoints,
  list,
  long,
  longArray,
  main,
  makeBox,
  markBlockDirty,
  mergeBoxes,
  mergeCommands,
  mirrorBlockstate,
  mirrorSelection,
  mostCommon,
  moveSelection,
  nbtEqual,
  nodeProblem,
  normalizeBlockData,
  parseBlockEntityKey,
  parse as parseBlockString,
  parseConfig,
  parseSectionKey,
  pasteClipboard,
  patches,
  placeBlock,
  placeCells,
  planImport,
  positionTag,
  pyFixed,
  pyStrip,
  ratio,
  raycast,
  readLitematic,
  readMcstructure,
  readNbt,
  readNbtFile,
  readSchem,
  readStructureNbt,
  replaceInSelection,
  reportToJson,
  resolveAssetsDir,
  resolveDataVersion,
  resolveMaterial,
  revertCommand,
  rotateBlockstate,
  rotatePoint,
  rotatePosition,
  rotateSelection,
  rotatedBox,
  runSkillCli,
  sectionKey2 as sectionKey,
  setBlockProperty,
  sha256,
  shapes_exports as shapes,
  shiftEntity,
  short,
  shortName,
  stacks,
  string,
  structureFromVolume,
  suggest,
  summary,
  tagId,
  titleCase,
  toScript,
  unitHash,
  viewEntry,
  voxelKey,
  withBlockProperty,
  writeLitematic,
  writeMcstructure,
  writeNbt,
  writeNbtGzip,
  writeSchem,
  writeStructureNbt
};
