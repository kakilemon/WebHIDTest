const lib = {
  globalPacketNumber: 0x00,

  MyTestFunction: function () {
    window.alert("Test");
  },

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

  $onInputReport: function (event) {
    if (!event.data) return;
    const dataArray = [
      event.reportId,
      event.device.productId,
      ...new Uint8Array(event.data.buffer),
    ];
    const dataStr = dataArray.map((byte) => byte.toString()).join();
    SendMessage("Test", "InputReport", dataStr);
  },

  SendCommand: async function (subCommand, subCommandArguments) {
    if (this.device === undefined) {
      return;
    }
    this.globalPacketNumber++;
    this.device.sendReport(0x01, createQuery(subCommand, subCommandArguments));
  },

  RequestDevice: async function () {
    if (navigator.hid === undefined) {
      window.alert("unsupported browser");
      return;
    }
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
    await delay(200);
    await _SendCommand(0x40, 0x01); // Enable IMU
    await _SendCommand(0x03, 0x30); // Set input report mode

    device.addEventListener("inputreport", onInputReport);
  },
};

autoAddDeps(lib, "$delay");
autoAddDeps(lib, "$createQuery");
autoAddDeps(lib, "$onInputReport");
mergeInto(LibraryManager.library, lib);
