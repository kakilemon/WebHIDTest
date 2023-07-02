using System.Collections;
using System.Collections.Generic;
using AOT;
using System;
using System.Runtime.InteropServices;
using UnityEngine;
using System.Linq;

public class Test : MonoBehaviour
{
    const int L_PRODUCT_ID = 0x2006;
    const int R_PRODUCT_ID = 0x2007;

    [SerializeField]
    DebugInfo debug;
    [SerializeField]
    Vector3 accel, gyro;
    [SerializeField]
    Transform obj;

    // Start is called before the first frame update
    private void Update()
    {
        string log = "";
        log += HIDManager.AvailabilityState.ToString();
        if (HIDManager.IsConnectionActive)
        {
            log += $"\nProduct: {HIDManager.ProductName}";
            log += $"\nAccel: {HIDManager.Accel}";
            log += $"\nGyro: {HIDManager.Gyro}";
            float angle = 90 - Mathf.Atan2(-HIDManager.Accel.y, -HIDManager.Accel.x) * Mathf.Rad2Deg;
            log += $"\nAngle: {angle}";
        }
        debug.Log(log);

        if (Input.GetKeyDown(KeyCode.Return))
        {
            HIDManager.CallRequestDevice();
        }
    }

    public void InputReport(string data)
    {
        var values = data.Split(',').Select(x => int.Parse(x)).ToArray();
        Get6AxisInfo(values.Skip(14).Take(12).ToArray(), values[1]);
        string mes = "";
        mes += $"Input report ID: {values[0]}\n";
        string productName = "";
        switch(values[1])
        {
            case L_PRODUCT_ID:
                productName = "Joy-Con L";
                break;
            case R_PRODUCT_ID:
                productName = "Joy-Con R";
                break;
        }
        mes += $"Product ID: {values[1]}";
        if (productName != "")
        {
            mes += $" ({productName})";
        }
        mes += "\n";
        mes += $"Timer: {values[2]}\n";
        mes += $"accel: {accel}\ngyro: {gyro}";
        debug.Log(mes);
    }

    void Get6AxisInfo(int[] values, int productId)
    {
        bool isLeft = productId == L_PRODUCT_ID;
        accel = new Vector3
        {
            x = GetAcceleration(values[1], values[0], 0),
            y = GetAcceleration(values[3], values[2], 0),
            z = GetAcceleration(values[5], values[4], 0)
        };
        gyro = new Vector3
        {
            x = GetGyroDps(values[7], values[6], 0),
            y = GetGyroDps(values[9], values[8], 0),
            z = GetGyroDps(values[11], values[10], 0)
        };
        
    }

    int GetInt16LE(int upper, int lower)
    {
        int value = (upper << 8) | lower;
        if (value >= 1 << 15) value -= 1 << 16;
        return value;
    }

    
    float GetAcceleration(int upper, int lower, int offset)
    {
        return (GetInt16LE(upper, lower) - offset) * 0.000244f;
    }

    float GetGyroDps(int upper, int lower, int offset)
    {
        return (GetInt16LE(upper, lower) - offset) * 0.06103f;
    }

    float GetGyroRps(int upper, int lower, int offset)
    {
        return (GetInt16LE(upper, lower) - offset) * 0.0001694f;
    }
}
