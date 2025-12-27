# Python Examples - ScreenCraft API

Complete examples for integrating ScreenCraft API into your Python application.

## Table of Contents

- [Installation](#installation)
- [Basic Setup](#basic-setup)
- [Client Class](#client-class)
- [Screenshots](#screenshots)
- [PDFs](#pdfs)
- [Advanced Patterns](#advanced-patterns)
- [Error Handling](#error-handling)
- [Testing](#testing)

---

## Installation

```bash
# Using pip
pip install requests

# Using poetry
poetry add requests

# For async support
pip install aiohttp

# For type hints
pip install types-requests
```

---

## Basic Setup

### Environment Variables

Create a `.env` file:

```env
SCREENCRAFT_API_KEY=your-api-key-here
SCREENCRAFT_API_URL=https://api.screencraft.com
```

### Load Environment Variables

```python
# config.py
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv('SCREENCRAFT_API_KEY')
API_URL = os.getenv('SCREENCRAFT_API_URL', 'https://api.screencraft.com')

if not API_KEY:
    raise ValueError('SCREENCRAFT_API_KEY environment variable is required')
```

---

## Client Class

### Complete Python Client

```python
# screencraft_client.py
import requests
import time
from typing import Dict, List, Optional, Any, BinaryIO
from dataclasses import dataclass
from enum import Enum


class Status(str, Enum):
    PENDING = 'pending'
    PROCESSING = 'processing'
    COMPLETED = 'completed'
    FAILED = 'failed'


class Format(str, Enum):
    PNG = 'png'
    JPEG = 'jpeg'
    WEBP = 'webp'


class PdfFormat(str, Enum):
    LETTER = 'Letter'
    LEGAL = 'Legal'
    TABLOID = 'Tabloid'
    LEDGER = 'Ledger'
    A0 = 'A0'
    A1 = 'A1'
    A2 = 'A2'
    A3 = 'A3'
    A4 = 'A4'
    A5 = 'A5'
    A6 = 'A6'


@dataclass
class Viewport:
    width: int = 1920
    height: int = 1080
    device_scale_factor: Optional[float] = None
    is_mobile: Optional[bool] = None
    has_touch: Optional[bool] = None
    is_landscape: Optional[bool] = None


@dataclass
class Clip:
    x: int
    y: int
    width: int
    height: int


@dataclass
class WaitOptions:
    wait_until: str = 'load'  # load, domcontentloaded, networkidle0, networkidle2
    timeout: int = 30000
    delay: Optional[int] = None
    selector: Optional[str] = None


@dataclass
class Cookie:
    name: str
    value: str
    domain: Optional[str] = None
    path: Optional[str] = None
    expires: Optional[int] = None
    http_only: Optional[bool] = None
    secure: Optional[bool] = None
    same_site: Optional[str] = None  # Strict, Lax, None


class ScreenCraftError(Exception):
    """Custom exception for ScreenCraft API errors"""

    def __init__(self, message: str, code: str, status_code: Optional[int] = None, details: Optional[Dict] = None):
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.details = details or {}


class ScreenCraftClient:
    """ScreenCraft API Client for Python"""

    def __init__(self, api_key: str, base_url: str = 'https://api.screencraft.com'):
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'X-API-Key': api_key,
            'Content-Type': 'application/json',
        })

    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make HTTP request with error handling"""
        url = f'{self.base_url}{endpoint}'

        try:
            response = self.session.request(method, url, **kwargs)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            if e.response is not None:
                try:
                    error_data = e.response.json()
                    raise ScreenCraftError(
                        message=error_data.get('error', {}).get('message', str(e)),
                        code=error_data.get('error', {}).get('code', 'UNKNOWN_ERROR'),
                        status_code=e.response.status_code,
                        details=error_data.get('error', {}).get('details'),
                    )
                except ValueError:
                    raise ScreenCraftError(
                        message=str(e),
                        code='HTTP_ERROR',
                        status_code=e.response.status_code,
                    )
            raise

    def _download(self, endpoint: str) -> bytes:
        """Download binary data"""
        url = f'{self.base_url}{endpoint}'
        response = self.session.get(url)
        response.raise_for_status()
        return response.content

    # Screenshots

    def create_screenshot(
        self,
        url: str,
        viewport: Optional[Viewport] = None,
        full_page: bool = False,
        format: Format = Format.PNG,
        quality: Optional[int] = None,
        clip: Optional[Clip] = None,
        omit_background: bool = False,
        encoding: str = 'binary',
        wait_options: Optional[WaitOptions] = None,
        headers: Optional[Dict[str, str]] = None,
        cookies: Optional[List[Cookie]] = None,
        user_agent: Optional[str] = None,
        block_resources: Optional[List[str]] = None,
        async_mode: bool = False,
        webhook_url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create a screenshot"""
        payload = {
            'url': url,
            'fullPage': full_page,
            'format': format.value,
            'omitBackground': omit_background,
            'encoding': encoding,
            'async': async_mode,
        }

        if viewport:
            payload['viewport'] = {
                'width': viewport.width,
                'height': viewport.height,
                **({k: v for k, v in {
                    'deviceScaleFactor': viewport.device_scale_factor,
                    'isMobile': viewport.is_mobile,
                    'hasTouch': viewport.has_touch,
                    'isLandscape': viewport.is_landscape,
                }.items() if v is not None})
            }

        if quality is not None:
            payload['quality'] = quality

        if clip:
            payload['clip'] = {
                'x': clip.x,
                'y': clip.y,
                'width': clip.width,
                'height': clip.height,
            }

        if wait_options:
            payload['waitOptions'] = {
                'waitUntil': wait_options.wait_until,
                'timeout': wait_options.timeout,
                **({k: v for k, v in {
                    'delay': wait_options.delay,
                    'selector': wait_options.selector,
                }.items() if v is not None})
            }

        if headers:
            payload['headers'] = headers

        if cookies:
            payload['cookies'] = [
                {k: v for k, v in {
                    'name': cookie.name,
                    'value': cookie.value,
                    'domain': cookie.domain,
                    'path': cookie.path,
                    'expires': cookie.expires,
                    'httpOnly': cookie.http_only,
                    'secure': cookie.secure,
                    'sameSite': cookie.same_site,
                }.items() if v is not None}
                for cookie in cookies
            ]

        if user_agent:
            payload['userAgent'] = user_agent

        if block_resources:
            payload['blockResources'] = block_resources

        if webhook_url:
            payload['webhookUrl'] = webhook_url

        if metadata:
            payload['metadata'] = metadata

        return self._request('POST', '/v1/screenshots', json=payload)

    def get_screenshot(self, screenshot_id: str) -> Dict[str, Any]:
        """Get screenshot status and metadata"""
        return self._request('GET', f'/v1/screenshots/{screenshot_id}')

    def list_screenshots(
        self,
        page: int = 1,
        limit: int = 20,
        status: Optional[Status] = None,
        sort_by: str = 'createdAt',
        sort_order: str = 'desc',
    ) -> Dict[str, Any]:
        """List screenshots with pagination and filtering"""
        params = {
            'page': page,
            'limit': limit,
            'sortBy': sort_by,
            'sortOrder': sort_order,
        }
        if status:
            params['status'] = status.value

        return self._request('GET', '/v1/screenshots', params=params)

    def download_screenshot(self, screenshot_id: str) -> bytes:
        """Download screenshot binary data"""
        return self._download(f'/v1/screenshots/{screenshot_id}/download')

    def delete_screenshot(self, screenshot_id: str) -> None:
        """Delete a screenshot"""
        url = f'{self.base_url}/v1/screenshots/{screenshot_id}'
        response = self.session.delete(url)
        response.raise_for_status()

    def wait_for_screenshot(
        self,
        screenshot_id: str,
        max_attempts: int = 60,
        interval_seconds: int = 2,
    ) -> Dict[str, Any]:
        """Wait for screenshot to complete"""
        for _ in range(max_attempts):
            response = self.get_screenshot(screenshot_id)
            status = response['data']['status']

            if status == Status.COMPLETED.value:
                return response['data']
            elif status == Status.FAILED.value:
                error = response['data'].get('error', 'Unknown error')
                raise ScreenCraftError(f'Screenshot failed: {error}', 'SCREENSHOT_FAILED')

            time.sleep(interval_seconds)

        raise ScreenCraftError('Screenshot timeout: max attempts reached', 'TIMEOUT')

    # PDFs

    def create_pdf_from_url(
        self,
        url: str,
        format: PdfFormat = PdfFormat.A4,
        landscape: bool = False,
        print_background: bool = True,
        margin: Optional[Dict[str, str]] = None,
        display_header_footer: bool = False,
        header_template: Optional[str] = None,
        footer_template: Optional[str] = None,
        page_ranges: Optional[str] = None,
        prefer_css_page_size: bool = False,
        width: Optional[str] = None,
        height: Optional[str] = None,
        scale: float = 1.0,
        wait_options: Optional[WaitOptions] = None,
        headers: Optional[Dict[str, str]] = None,
        cookies: Optional[List[Cookie]] = None,
        user_agent: Optional[str] = None,
        async_mode: bool = False,
        webhook_url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create PDF from URL"""
        payload = {
            'type': 'url',
            'url': url,
            'format': format.value,
            'landscape': landscape,
            'printBackground': print_background,
            'displayHeaderFooter': display_header_footer,
            'preferCSSPageSize': prefer_css_page_size,
            'scale': scale,
            'async': async_mode,
        }

        if margin:
            payload['margin'] = margin

        if header_template:
            payload['headerTemplate'] = header_template

        if footer_template:
            payload['footerTemplate'] = footer_template

        if page_ranges:
            payload['pageRanges'] = page_ranges

        if width:
            payload['width'] = width

        if height:
            payload['height'] = height

        if wait_options:
            payload['waitOptions'] = {
                'waitUntil': wait_options.wait_until,
                'timeout': wait_options.timeout,
                **({k: v for k, v in {
                    'delay': wait_options.delay,
                }.items() if v is not None})
            }

        if headers:
            payload['headers'] = headers

        if cookies:
            payload['cookies'] = [
                {k: v for k, v in {
                    'name': cookie.name,
                    'value': cookie.value,
                    'domain': cookie.domain,
                    'path': cookie.path,
                    'expires': cookie.expires,
                    'httpOnly': cookie.http_only,
                    'secure': cookie.secure,
                    'sameSite': cookie.same_site,
                }.items() if v is not None}
                for cookie in cookies
            ]

        if user_agent:
            payload['userAgent'] = user_agent

        if webhook_url:
            payload['webhookUrl'] = webhook_url

        if metadata:
            payload['metadata'] = metadata

        return self._request('POST', '/v1/pdfs', json=payload)

    def create_pdf_from_html(
        self,
        html: str,
        format: PdfFormat = PdfFormat.A4,
        landscape: bool = False,
        print_background: bool = True,
        margin: Optional[Dict[str, str]] = None,
        display_header_footer: bool = False,
        header_template: Optional[str] = None,
        footer_template: Optional[str] = None,
        page_ranges: Optional[str] = None,
        prefer_css_page_size: bool = False,
        width: Optional[str] = None,
        height: Optional[str] = None,
        scale: float = 1.0,
        async_mode: bool = False,
        webhook_url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create PDF from HTML content"""
        payload = {
            'type': 'html',
            'html': html,
            'format': format.value,
            'landscape': landscape,
            'printBackground': print_background,
            'displayHeaderFooter': display_header_footer,
            'preferCSSPageSize': prefer_css_page_size,
            'scale': scale,
            'async': async_mode,
        }

        if margin:
            payload['margin'] = margin

        if header_template:
            payload['headerTemplate'] = header_template

        if footer_template:
            payload['footerTemplate'] = footer_template

        if page_ranges:
            payload['pageRanges'] = page_ranges

        if width:
            payload['width'] = width

        if height:
            payload['height'] = height

        if webhook_url:
            payload['webhookUrl'] = webhook_url

        if metadata:
            payload['metadata'] = metadata

        return self._request('POST', '/v1/pdfs', json=payload)

    def get_pdf(self, pdf_id: str) -> Dict[str, Any]:
        """Get PDF status and metadata"""
        return self._request('GET', f'/v1/pdfs/{pdf_id}')

    def list_pdfs(
        self,
        page: int = 1,
        limit: int = 20,
        status: Optional[Status] = None,
        pdf_type: Optional[str] = None,
        sort_by: str = 'createdAt',
        sort_order: str = 'desc',
    ) -> Dict[str, Any]:
        """List PDFs with pagination and filtering"""
        params = {
            'page': page,
            'limit': limit,
            'sortBy': sort_by,
            'sortOrder': sort_order,
        }
        if status:
            params['status'] = status.value
        if pdf_type:
            params['type'] = pdf_type

        return self._request('GET', '/v1/pdfs', params=params)

    def download_pdf(self, pdf_id: str) -> bytes:
        """Download PDF binary data"""
        return self._download(f'/v1/pdfs/{pdf_id}/download')

    def delete_pdf(self, pdf_id: str) -> None:
        """Delete a PDF"""
        url = f'{self.base_url}/v1/pdfs/{pdf_id}'
        response = self.session.delete(url)
        response.raise_for_status()

    def wait_for_pdf(
        self,
        pdf_id: str,
        max_attempts: int = 60,
        interval_seconds: int = 2,
    ) -> Dict[str, Any]:
        """Wait for PDF to complete"""
        for _ in range(max_attempts):
            response = self.get_pdf(pdf_id)
            status = response['data']['status']

            if status == Status.COMPLETED.value:
                return response['data']
            elif status == Status.FAILED.value:
                error = response['data'].get('error', 'Unknown error')
                raise ScreenCraftError(f'PDF generation failed: {error}', 'PDF_FAILED')

            time.sleep(interval_seconds)

        raise ScreenCraftError('PDF timeout: max attempts reached', 'TIMEOUT')

    # Utils

    def health_check(self) -> Dict[str, Any]:
        """Check API health"""
        return self._request('GET', '/health')
```

---

## Screenshots

### Basic Screenshot

```python
from screencraft_client import ScreenCraftClient, Format
from config import API_KEY

def basic_screenshot():
    client = ScreenCraftClient(API_KEY)

    response = client.create_screenshot(
        url='https://example.com',
        format=Format.PNG,
    )

    print(f"Screenshot created: {response['data']['id']}")

    # Download screenshot
    image_data = client.download_screenshot(response['data']['id'])

    with open('screenshot.png', 'wb') as f:
        f.write(image_data)

    print('Screenshot saved to screenshot.png')

if __name__ == '__main__':
    basic_screenshot()
```

### Full Page Screenshot

```python
def full_page_screenshot():
    client = ScreenCraftClient(API_KEY)

    response = client.create_screenshot(
        url='https://example.com',
        full_page=True,
        format=Format.JPEG,
        quality=90,
    )

    image_data = client.download_screenshot(response['data']['id'])

    with open('fullpage.jpg', 'wb') as f:
        f.write(image_data)

    print('Full page screenshot saved')
```

### Mobile Viewport

```python
from screencraft_client import Viewport

def mobile_screenshot():
    client = ScreenCraftClient(API_KEY)

    response = client.create_screenshot(
        url='https://example.com',
        viewport=Viewport(
            width=375,
            height=812,
            device_scale_factor=3,
            is_mobile=True,
            has_touch=True,
        ),
        format=Format.PNG,
    )

    image_data = client.download_screenshot(response['data']['id'])

    with open('mobile.png', 'wb') as f:
        f.write(image_data)
```

### Async Screenshot with Polling

```python
def async_screenshot():
    client = ScreenCraftClient(API_KEY)

    # Create async screenshot
    response = client.create_screenshot(
        url='https://example.com',
        full_page=True,
        async_mode=True,
    )

    screenshot_id = response['data']['id']
    print(f'Screenshot queued: {screenshot_id}')

    # Wait for completion
    screenshot = client.wait_for_screenshot(screenshot_id)
    print(f'Screenshot completed: {screenshot["downloadUrl"]}')

    # Download
    image_data = client.download_screenshot(screenshot_id)

    with open('async-screenshot.png', 'wb') as f:
        f.write(image_data)
```

### Screenshot with Authentication

```python
def authenticated_screenshot():
    client = ScreenCraftClient(API_KEY)

    from screencraft_client import Cookie

    response = client.create_screenshot(
        url='https://example.com/dashboard',
        headers={
            'Authorization': 'Bearer your-token',
        },
        cookies=[
            Cookie(
                name='session_id',
                value='abc123',
                domain='example.com',
                secure=True,
                http_only=True,
            )
        ],
        format=Format.PNG,
    )

    image_data = client.download_screenshot(response['data']['id'])

    with open('authenticated.png', 'wb') as f:
        f.write(image_data)
```

### Batch Screenshots

```python
import concurrent.futures

def batch_screenshots():
    client = ScreenCraftClient(API_KEY)

    urls = [
        'https://example.com',
        'https://example.org',
        'https://example.net',
    ]

    # Create all screenshots
    screenshot_ids = []
    for url in urls:
        response = client.create_screenshot(
            url=url,
            async_mode=True,
            metadata={'url': url},
        )
        screenshot_ids.append(response['data']['id'])

    print(f'Screenshots queued: {screenshot_ids}')

    # Wait for all to complete using thread pool
    def wait_and_download(screenshot_id):
        screenshot = client.wait_for_screenshot(screenshot_id)
        image_data = client.download_screenshot(screenshot_id)

        filename = f'screenshot-{screenshot_id}.png'
        with open(filename, 'wb') as f:
            f.write(image_data)

        return filename

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        filenames = list(executor.map(wait_and_download, screenshot_ids))

    print(f'Saved: {filenames}')
```

---

## PDFs

### Basic PDF from URL

```python
from screencraft_client import PdfFormat

def basic_pdf():
    client = ScreenCraftClient(API_KEY)

    response = client.create_pdf_from_url(
        url='https://example.com',
        format=PdfFormat.A4,
        print_background=True,
    )

    pdf_data = client.download_pdf(response['data']['id'])

    with open('document.pdf', 'wb') as f:
        f.write(pdf_data)

    print('PDF saved to document.pdf')
```

### PDF from HTML Template

```python
from datetime import datetime

def pdf_from_html():
    client = ScreenCraftClient(API_KEY)

    html = f'''
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {{ font-family: Arial, sans-serif; margin: 40px; }}
          h1 {{ color: #333; }}
          .invoice {{ border: 1px solid #ddd; padding: 20px; }}
        </style>
      </head>
      <body>
        <div class="invoice">
          <h1>Invoice #12345</h1>
          <p>Date: {datetime.now().strftime('%Y-%m-%d')}</p>
          <p>Total: $99.99</p>
        </div>
      </body>
    </html>
    '''

    response = client.create_pdf_from_html(
        html=html,
        format=PdfFormat.A4,
    )

    pdf_data = client.download_pdf(response['data']['id'])

    with open('invoice.pdf', 'wb') as f:
        f.write(pdf_data)

    print('Invoice PDF saved')
```

### PDF with Header and Footer

```python
def pdf_with_header_footer():
    client = ScreenCraftClient(API_KEY)

    response = client.create_pdf_from_url(
        url='https://example.com',
        format=PdfFormat.A4,
        display_header_footer=True,
        header_template='''
            <div style="font-size:10px; text-align:center; width:100%; padding:10px;">
                <strong>Company Name</strong>
            </div>
        ''',
        footer_template='''
            <div style="font-size:10px; text-align:center; width:100%; padding:10px;">
                Page <span class="pageNumber"></span> of <span class="totalPages"></span>
            </div>
        ''',
        margin={
            'top': '40mm',
            'bottom': '30mm',
            'left': '15mm',
            'right': '15mm',
        },
    )

    pdf_data = client.download_pdf(response['data']['id'])

    with open('report.pdf', 'wb') as f:
        f.write(pdf_data)
```

### Async PDF Generation

```python
def async_pdf():
    client = ScreenCraftClient(API_KEY)

    response = client.create_pdf_from_url(
        url='https://example.com',
        format=PdfFormat.A4,
        async_mode=True,
    )

    pdf_id = response['data']['id']
    print(f'PDF queued: {pdf_id}')

    # Wait for completion
    pdf = client.wait_for_pdf(pdf_id)
    print(f'PDF completed: {pdf["downloadUrl"]}')

    # Download
    pdf_data = client.download_pdf(pdf_id)

    with open('async-document.pdf', 'wb') as f:
        f.write(pdf_data)
```

---

## Advanced Patterns

### Async Client (aiohttp)

```python
# async_client.py
import aiohttp
import asyncio
from typing import Dict, Any

class AsyncScreenCraftClient:
    """Async ScreenCraft API Client using aiohttp"""

    def __init__(self, api_key: str, base_url: str = 'https://api.screencraft.com'):
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.headers = {
            'X-API-Key': api_key,
            'Content-Type': 'application/json',
        }

    async def create_screenshot(self, url: str, **kwargs) -> Dict[str, Any]:
        """Create screenshot asynchronously"""
        payload = {'url': url, **kwargs}

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f'{self.base_url}/v1/screenshots',
                json=payload,
                headers=self.headers,
            ) as response:
                response.raise_for_status()
                return await response.json()

    async def download_screenshot(self, screenshot_id: str) -> bytes:
        """Download screenshot asynchronously"""
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f'{self.base_url}/v1/screenshots/{screenshot_id}/download',
                headers={'X-API-Key': self.api_key},
            ) as response:
                response.raise_for_status()
                return await response.read()

# Usage
async def main():
    client = AsyncScreenCraftClient(API_KEY)

    response = await client.create_screenshot(
        url='https://example.com',
        format='png',
    )

    image_data = await client.download_screenshot(response['data']['id'])

    with open('screenshot.png', 'wb') as f:
        f.write(image_data)

if __name__ == '__main__':
    asyncio.run(main())
```

### Webhook Handler (Flask)

```python
# webhook_server.py
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/webhooks/screenshot', methods=['POST'])
def screenshot_webhook():
    data = request.json
    screenshot_id = data.get('id')
    status = data.get('status')

    print(f'Screenshot webhook received: {screenshot_id}')

    if status == 'completed':
        print(f'Download URL: {data.get("downloadUrl")}')
        # Process the screenshot
    elif status == 'failed':
        print(f'Screenshot failed: {data.get("error")}')

    return jsonify({'status': 'ok'}), 200

@app.route('/webhooks/pdf', methods=['POST'])
def pdf_webhook():
    data = request.json
    pdf_id = data.get('id')
    status = data.get('status')

    print(f'PDF webhook received: {pdf_id}')

    if status == 'completed':
        print(f'Download URL: {data.get("downloadUrl")}')
        # Process the PDF
    elif status == 'failed':
        print(f'PDF failed: {data.get("error")}')

    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    app.run(port=3001)
```

### Retry Logic with Exponential Backoff

```python
import time
from functools import wraps

def retry_with_backoff(max_retries=3, base_delay=1):
    """Decorator for retry logic with exponential backoff"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except ScreenCraftError as e:
                    if attempt == max_retries - 1:
                        raise

                    delay = base_delay * (2 ** attempt)
                    print(f'Attempt {attempt + 1} failed: {e.message}. Retrying in {delay}s...')
                    time.sleep(delay)
            return None
        return wrapper
    return decorator

@retry_with_backoff(max_retries=3, base_delay=2)
def screenshot_with_retry(url: str) -> bytes:
    client = ScreenCraftClient(API_KEY)
    response = client.create_screenshot(url=url, format=Format.PNG)
    return client.download_screenshot(response['data']['id'])
```

### Django Integration

```python
# views.py
from django.http import JsonResponse, FileResponse
from django.views.decorators.http import require_http_methods
from screencraft_client import ScreenCraftClient, Format
from .models import Screenshot
from django.conf import settings

client = ScreenCraftClient(settings.SCREENCRAFT_API_KEY)

@require_http_methods(['POST'])
def create_screenshot(request):
    url = request.POST.get('url')

    try:
        response = client.create_screenshot(
            url=url,
            format=Format.PNG,
            async_mode=True,
            webhook_url=f'{settings.SITE_URL}/webhooks/screenshot',
        )

        # Save to database
        screenshot = Screenshot.objects.create(
            screenshot_id=response['data']['id'],
            url=url,
            status='pending',
        )

        return JsonResponse({
            'id': screenshot.id,
            'screenshot_id': screenshot.screenshot_id,
            'status': screenshot.status,
        })
    except ScreenCraftError as e:
        return JsonResponse({'error': str(e)}, status=400)

@require_http_methods(['POST'])
def screenshot_webhook(request):
    data = request.json()
    screenshot_id = data.get('id')

    try:
        screenshot = Screenshot.objects.get(screenshot_id=screenshot_id)
        screenshot.status = data.get('status')
        screenshot.download_url = data.get('downloadUrl')
        screenshot.save()

        if screenshot.status == 'completed':
            # Download and save to media
            image_data = client.download_screenshot(screenshot_id)
            # ... save to file storage

        return JsonResponse({'status': 'ok'})
    except Screenshot.DoesNotExist:
        return JsonResponse({'error': 'Screenshot not found'}, status=404)
```

---

## Error Handling

### Comprehensive Error Handling

```python
from screencraft_client import ScreenCraftClient, ScreenCraftError

def handle_errors():
    client = ScreenCraftClient(API_KEY)

    try:
        response = client.create_screenshot(
            url='https://example.com',
            format=Format.PNG,
        )
        print(f'Success: {response["data"]["id"]}')

    except ScreenCraftError as e:
        if e.code == 'VALIDATION_ERROR':
            print(f'Validation failed: {e.details}')
        elif e.code == 'RATE_LIMIT_EXCEEDED':
            print(f'Rate limited. Reset at: {e.details.get("reset")}')
        elif e.code == 'UNAUTHORIZED':
            print('Invalid API key')
        else:
            print(f'API error: {e.message}')

    except Exception as e:
        print(f'Unexpected error: {e}')
```

---

## Testing

### Unit Tests (pytest)

```python
# test_screencraft_client.py
import pytest
from unittest.mock import Mock, patch
from screencraft_client import ScreenCraftClient, ScreenCraftError, Format

@pytest.fixture
def client():
    return ScreenCraftClient('test-api-key')

def test_create_screenshot_success(client):
    with patch.object(client.session, 'request') as mock_request:
        mock_response = Mock()
        mock_response.json.return_value = {
            'success': True,
            'data': {
                'id': '123e4567-e89b-12d3-a456-426614174000',
                'status': 'completed',
                'url': 'https://example.com',
                'format': 'png',
            },
        }
        mock_response.raise_for_status = Mock()
        mock_request.return_value = mock_response

        result = client.create_screenshot(
            url='https://example.com',
            format=Format.PNG,
        )

        assert result['success'] is True
        assert result['data']['id'] == '123e4567-e89b-12d3-a456-426614174000'

def test_create_screenshot_validation_error(client):
    with patch.object(client.session, 'request') as mock_request:
        mock_response = Mock()
        mock_response.status_code = 400
        mock_response.json.return_value = {
            'success': False,
            'error': {
                'code': 'VALIDATION_ERROR',
                'message': 'Invalid URL',
            },
        }
        mock_request.return_value = mock_response
        mock_response.raise_for_status.side_effect = Exception('HTTP Error')

        with pytest.raises(ScreenCraftError) as exc_info:
            client.create_screenshot(
                url='invalid-url',
                format=Format.PNG,
            )

        assert exc_info.value.code == 'VALIDATION_ERROR'
```

---

## Complete Example Script

```python
#!/usr/bin/env python3
# main.py
import os
from screencraft_client import ScreenCraftClient, Format, PdfFormat, Viewport
from config import API_KEY

def main():
    client = ScreenCraftClient(API_KEY)

    # Health check
    health = client.health_check()
    print(f'API Status: {health["status"]}')

    # Create output directory
    os.makedirs('output', exist_ok=True)

    # Screenshot
    print('Creating screenshot...')
    screenshot = client.create_screenshot(
        url='https://example.com',
        full_page=True,
        format=Format.PNG,
    )

    screenshot_data = client.download_screenshot(screenshot['data']['id'])
    with open('output/screenshot.png', 'wb') as f:
        f.write(screenshot_data)
    print('Screenshot saved!')

    # PDF
    print('Creating PDF...')
    pdf = client.create_pdf_from_url(
        url='https://example.com',
        format=PdfFormat.A4,
        print_background=True,
    )

    pdf_data = client.download_pdf(pdf['data']['id'])
    with open('output/document.pdf', 'wb') as f:
        f.write(pdf_data)
    print('PDF saved!')

    # List resources
    screenshots = client.list_screenshots(limit=10)
    print(f'Total screenshots: {screenshots["meta"]["pagination"]["total"]}')

    pdfs = client.list_pdfs(limit=10)
    print(f'Total PDFs: {pdfs["meta"]["pagination"]["total"]}')

if __name__ == '__main__':
    main()
```

Run with:
```bash
python main.py
```
