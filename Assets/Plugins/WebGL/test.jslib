const lib = {
  globalPacketNumber: 0x00,

  MyTestFunction: function () {
    window.alert("Test");
  },

  $callbacks: {},

  $delay: async function (delayMs) {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  },

  $createQuery: function (subCommand, subCommandArguments) {
    const query = new Array(48).fill(0x00);
    query[0] = this.globalPacketNumber % 0x10; // 0x0 ~ 0xf
    query[1] = 0x00;
    query[2] = 0x01;
    query[3] = 0x40;
    query[4] = 0x40;
    query[5] = 0x00;
    query[6] = 0x01;
    query[7] = 0x40;
    query[8] = 0x40;
    query[9] = subCommand;
    query[10] = subCommandArguments;
    return Uint8Array.from(query);
  },

  // Codes derived from:
  // https://github.com/tomayac/joy-con-webhid/blob/main/src/joycon.js
  $rumble: async function (lowFrequency, highFrequency, amplitude) {
    const clamp = (value, min, max) => {
      return Math.min(Math.max(value, min), max);
    };
    const data = new Uint8Array(9);

    // Referenced codes below:
    // https://github.com/Looking-Glass/JoyconLib/blob/master/Packages/com.lookingglass.joyconlib/JoyconLib_scripts/Joycon.cs
    data[0] = 0x00;

    let lf = clamp(lowFrequency, 40.875885, 626.286133);
    let hf = clamp(highFrequency, 81.75177, 1252.572266);

    hf = (Math.round(32 * Math.log2(hf * 0.1)) - 0x60) * 4;
    lf = Math.round(32 * Math.log2(lf * 0.1)) - 0x40;

    const amp = clamp(amplitude, 0, 1);

    let hfAmp;
    if (amp == 0) {
      hfAmp = 0;
    } else if (amp < 0.117) {
      hfAmp = (Math.log2(amp * 1000) * 32 - 0x60) / (5 - Math.pow(amp, 2)) - 1;
    } else if (amp < 0.23) {
      hfAmp = Math.log2(amp * 1000) * 32 - 0x60 - 0x5c;
    } else {
      hfAmp = (Math.log2(amp * 1000) * 32 - 0x60) * 2 - 0xf6;
    }

    let lfAmp = Math.round(hfAmp) * 0.5;
    const parity = lfAmp % 2;
    if (parity > 0) {
      --lfAmp;
    }
    lfAmp = lfAmp >> 1;
    lfAmp += 0x40;
    if (parity > 0) {
      lfAmp |= 0x8000;
    }

    data[1] = hf & 0xff;
    data[2] = hfAmp + ((hf >>> 8) & 0xff);
    data[3] = lf + ((lfAmp >>> 8) & 0xff);
    data[4] += lfAmp & 0xff;

    for (let i = 0; i < 4; i++) {
      data[5 + i] = data[1 + i];
    }

    await this.device.sendReport(0x01, new Uint8Array(data));
  },

  $onInputReport: function (event) {
    if (!event.data) return;
    const dataArray = [
      event.reportId,
      event.device.productId,
      ...new Uint8Array(event.data.buffer),
    ];
    const dataArrayPtr = _malloc(dataArray.length * 4);
    HEAP32.set(dataArray, dataArrayPtr / 4);
    Module["dynCall_vii"](
      callbacks.inputReport,
      dataArrayPtr,
      dataArray.length
    );
  },

  // 0: available
  // 1: unsupported browse
  // 2: disallowed by permission policy
  CheckHIDAvailableState: async function (callbackPtr) {
    if (navigator.hid === undefined) {
      Module["dynCall_vi"](callbackPtr, 1);
      return;
    }
    try {
      await navigator.hid.getDevices();
      Module["dynCall_vi"](callbackPtr, 0);
      return;
    } catch (error) {
      Module["dynCall_vi"](callbackPtr, 2);
      return;
    }
  },

  SendCommand: async function (subCommand, subCommandArguments) {
    if (!this.device) {
      return;
    }
    this.globalPacketNumber++;
    await this.device.sendReport(
      0x01,
      createQuery(subCommand, subCommandArguments)
    );
  },

  RequestDevice: async function (callbackPtr) {
    if (navigator.hid === undefined) {
      window.alert("unsupported browser");
      return;
    }
    callbacks.inputReport = callbackPtr;
    if (this.device) {
      this.device.removeEventListener("inputreport", onInputReport);
      if (this.device.opened) {
        await this.device.close();
      }
      this.device = null;
    }

    const filters = [
      {
        vendorId: 0x057e, // Nintendo Co., Ltd
        productId: 0x2006, // Joy-Con Left
      },
      {
        vendorId: 0x057e, // Nintendo Co., Ltd
        productId: 0x2007, // Joy-Con Right
      },
    ];

    const [device] = await navigator.hid.requestDevice({ filters });
    if (!device) {
      return;
    }
    this.device = device;
    if (!device.opened) {
      await device.open();
    }

    await _SendCommand(0x30, 0x01); // Turn on light
    await _SendCommand(0x48, 0x01); // Enable rumble
    await delay(200);

    await _SendCommand(0x40, 0x01); // Enable IMU
    await _SendCommand(0x03, 0x30); // Set input report mode

    device.addEventListener("inputreport", onInputReport);

    await rumble(160, 320, 0.3);
    await delay(200);
    await _SendCommand(0x48, 0x00); // Disable rumble
  },
};

autoAddDeps(lib, "$callbacks");
autoAddDeps(lib, "$delay");
autoAddDeps(lib, "$createQuery");
autoAddDeps(lib, "$rumble");
autoAddDeps(lib, "$onInputReport");
mergeInto(LibraryManager.library, lib);
