import axios from "axios";

export async function httpJson({ url, method, headers, data, timeoutMs }) {
    const res = await axios.request({
        url,
        method,
        headers,
        data,
        timeout: timeoutMs,
        validateStatus: () => true,
    });

    return { statusCode: res.status, data: res.data };
}
