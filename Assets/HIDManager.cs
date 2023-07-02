using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using AOT;
using System;
using System.Runtime.InteropServices;
using System.Linq;

public enum HIDAvailabilityState
{
    NotReady,
    Available,
    Unsupported,
    Disallowed
}

public enum ProductType
{
    Unknown,
    LeftJoycon,
    RightJoycon
}

public static class HIDManager
{
    const int L_PRODUCT_ID = 0x2006;
    const int R_PRODUCT_ID = 0x2007;
    const float connectionLostTime = 1f;

    [DllImport("__Internal")]
    private static extern void CheckHIDAvailableState(Action<int> callback);
    [DllImport("__Internal")]
    private static extern void RequestDevice(Action<IntPtr, int> callback);
    [DllImport("__Internal")]
    private static extern void SendCommand(uint subCommand, uint subCommandArguments);

    public static HIDAvailabilityState AvailabilityState { get; private set; }
    public static bool IsConnectionActive => AvailabilityState == HIDAvailabilityState.Available && Time.realtimeSinceStartup < lastConnectedTime + connectionLostTime;
    public static ProductType Product { get; private set; }
    public static string ProductName { get; private set; }
    public static int Timer { get; private set; }
    
    public static Vector3 Accel { get; private set; }
    public static Vector3 Gyro { get; private set; }

    static float lastConnectedTime;

    static HIDManager()
    {
        AvailabilityState = HIDAvailabilityState.NotReady;
        lastConnectedTime = Time.realtimeSinceStartup - connectionLostTime;
        CheckHIDAvailableState(CheckHIDAvailableStateCallback);
    }

    public static void CallRequestDevice()
    {
        if (AvailabilityState != HIDAvailabilityState.Available)
        {
            return;
        }
        RequestDevice(InputReportCallback);
    }

    [MonoPInvokeCallback(typeof(Action<int>))]
    static void CheckHIDAvailableStateCallback(int state)
    {
        switch (state)
        {
            case 0:
                AvailabilityState = HIDAvailabilityState.Available;
                break;
            case 1:
                AvailabilityState = HIDAvailabilityState.Unsupported;
                break;
            case 2:
                AvailabilityState = HIDAvailabilityState.Disallowed;
                break;
        }
    }

    [MonoPInvokeCallback(typeof(Action<IntPtr, int>))]
    static void InputReportCallback(IntPtr dataPtr, int length)
    {
        lastConnectedTime = Time.realtimeSinceStartup;
        var data = new int[length];
        Marshal.Copy(dataPtr, data, 0, length);
        switch(data[1])
        {
            case L_PRODUCT_ID:
                Product = ProductType.LeftJoycon;
                ProductName = "Joy-Con L";
                break;
            case R_PRODUCT_ID:
                Product = ProductType.RightJoycon;
                ProductName = "Joy-Con R";
                break;
            default:
                Product = ProductType.Unknown;
                ProductName = "Unknown Device";
                break;
        }
        Timer = data[2];
        Get6AxisInfo(data.Skip(14).Take(12).ToArray());
    }

    static void Get6AxisInfo(int[] values)
    {
        var rawAccel = new Vector3
        {
            x = GetAcceleration(values[1], values[0], 0),
            y = GetAcceleration(values[3], values[2], 0),
            z = GetAcceleration(values[5], values[4], 0)
        };
        if (Product == ProductType.LeftJoycon)
        {
            Accel = new Vector3(rawAccel.y, -rawAccel.x, rawAccel.z);
        }
        else if (Product == ProductType.RightJoycon)
        {
            Accel = new Vector3(-rawAccel.y, -rawAccel.x, -rawAccel.z);
        }
        else
        {
            Accel = Vector3.zero;
        }
        Gyro = new Vector3
        {
            x = GetGyroDps(values[7], values[6], 0),
            y = GetGyroDps(values[9], values[8], 0),
            z = GetGyroDps(values[11], values[10], 0)
        };

    }

    static int GetInt16LE(int upper, int lower)
    {
        int value = (upper << 8) | lower;
        if (value >= 1 << 15) value -= 1 << 16;
        return value;
    }


    static float GetAcceleration(int upper, int lower, int offset)
    {
        return (GetInt16LE(upper, lower) - offset) * 0.000244f;
    }

    static float GetGyroDps(int upper, int lower, int offset)
    {
        return (GetInt16LE(upper, lower) - offset) * 0.06103f;
    }
}
