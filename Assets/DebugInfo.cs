using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using TMPro;

public class DebugInfo : MonoBehaviour
{
    [SerializeField]
    TextMeshProUGUI text;

    public void Log(string mes)
    {
        text.text = mes;
    }
}
